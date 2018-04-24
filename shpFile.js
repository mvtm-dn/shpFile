/* jshint esnext:true */
/* jshint node: true */

'use strict';

const EventEmitter=require('events').EventEmitter;
const fs=require("fs");
const util = require('util');
const dbfstream = require('dbfstream');

var genReadArray=function(type){
    return function(buffer,offset,length) {
        length=length===undefined?1:length;
        offset=offset||0;
/*jshint -W055 */
        return (new type(buffer,offset,length));
/*jshint +W055 */
    };
},

    _readInt=genReadArray(Int32Array),
    _readDouble=genReadArray(Float64Array),

    readInt=function(buffer,offset,length,isBigEndian) {
        var ret;
        if (buffer instanceof Buffer) {
            length=length===undefined?1:length;
            offset=offset||0;
            ret=new Int32Array(length);
            var rf=isBigEndian?buffer.readInt32BE.bind(buffer):buffer.readInt32LE.bind(buffer);
            for(var i=0;i<length;i+=1) {
                ret[i]=rf(offset+(i<<2));
            }
        }
        else {
            ret=_readInt(buffer,offset,length);
        }
        return ret;
    },

    readDouble=function(buffer,offset,length,isBigEndian) {
        var ret;
        if (buffer instanceof Buffer) {
            length=length===undefined?1:length;
            offset=offset||0;
            ret=new Float64Array(length);
            var rf=isBigEndian?buffer.readDoubleBE.bind(buffer):buffer.readDoubleLE.bind(buffer);
            for(var i=0;i<length;i+=1) {
                ret[i]=rf(offset+(i<<3));
            }
        }
        else {
            ret=_readInt(buffer,offset,length);
        }
        return ret;
    },

    _dummyTranslate={
        forward:function(x){return x;},
        inverse:function(x){return x;}
    },

 
    parseFile=function(source,translate,filter) {
        if (!(this instanceof parseFile)) {
            return new parseFile(source,translate,filter);
        }
        if (filter) {
            this._filter=filter;
        }
        else {
            this._filter=()=>true;
        }
        EventEmitter.call(this);
        this.translate=translate || _dummyTranslate;
        this._preinit();
        source=(Array.isArray(source)?source:[source]);
        source[0]=util.isString(source[0])?fs.createReadStream(source[0]):source[0];
        var self=this;
        source[0].on("error",(error)=>{
            self.emit("error",error);
        });
        var startParse=this._startParse.bind(this,source[0]);
        if (source.length>1) {
// first element - shape stream
            this._preinit();
            dbfstream(source[1]).on("data",this._storeProperties.bind(this))
                .on("error",startParse)
                .on("end",startParse);
// second one - dbf stream
//            var dbf=dbfstream(        
        }
        else {
            startParse();
        }
    };
    
util.inherits(parseFile,EventEmitter);

parseFile.prototype._startParse=function(source) {
    var self=this;
    source.on("data",this._toBuffer.bind(this))
        .on("end",this.parseBuffer.bind(this));
};

parseFile.prototype._storeProperties=function(data) {
    var x={};
    Object.keys(data).forEach((v)=>{
        if (v.substr(0,1)!=='@') {
            x[v]=data[v];
        }
    });
    this.props.push(x);
};

parseFile.prototype._toBuffer=function(chunk) {
    if (!this._data) {
        this._data=[];
    }
    this._data.push(chunk);
};
    
parseFile.prototype._preinit=function() {
    this.shapes=[];
    this.props=[];
    var xy=this.translate.forward([-180,-90]),xy1=this.translate.forward([180,90]);
    this.bbox=[xy[0],xy[1],xy1[0],xy1[1]];
};


parseFile.prototype.parseBuffer=function() {
    if (this._data && this._data.length) {
        var buffer=Buffer.concat(this._data);
        var shapes=[],offset=100,header,reader,bbox=this._readBbox(buffer,36),currentShape,shapeIndex=0;
        while(offset<buffer.length) {
            header=this._readRecordHeader(buffer,offset);
            reader=header.type<parseFile.readers.length?parseFile.readers[header.type]:parseFile.prototype._typeNoShape;
            currentShape=reader.apply(this,[buffer,header,offset+8])
            if (this.props[shapeIndex]) {
                currentShape.properties=this.props[shapeIndex];
            }
            if (this._filter(currentShape)) {
                shapes.push(currentShape);
            }
            shapeIndex+=1;
            offset+=(4+header.size)*2;
        }
        this.shapes=shapes;
        this.bbox=bbox;
        this._data=undefined;
        this.length=shapes.length;
        this.emit("end",this);
    }
    else {
        this.emit("end",this);
    }
};

parseFile.prototype._readBbox=function(buffer,offset) {
    var x=readDouble(buffer,offset,2),y=readDouble(buffer,offset+16,2),ret=[];
    ret.push.apply(ret,this.translate.forward([x[0],x[1]]));
    ret.push.apply(ret,this.translate.forward([y[0],y[1]]));
    return ret;
};

parseFile.prototype._readRecordHeader=function(buffer,offset) {
    var t=readInt(buffer,offset,2,true);
    return {
        no:t[0],size:t[1],type:readInt(buffer,offset+8)[0]
    };
};

parseFile.prototype._readOnePoint=function(buffer,offset) {
    var t=readDouble(buffer,offset,2);
    return this.translate.forward({x:t[0],y:t[1]});
};

parseFile.prototype._readPoints=function(buffer,offset,numpoints) {
    var t=readDouble(buffer,offset,numpoints*2);
    var ret=[];
    for(var i=0;i<numpoints;i+=1) {
        ret.push(this.translate.forward({x:t[i*2],y:t[i*2+1]}));
    }
    return ret;
};


parseFile.prototype._typeNoShape=function(buffer,header,offset) {
    return {type:header.type};
};

parseFile.prototype._typePoint=function(buffer,header,offset) { // type===1;
    return {type:header.type, points:[this._readOnePoint(buffer,offset+4)]};
};

parseFile.prototype._typePointZ=function(buffer,header,offset) { // type===11;
    var zm=readDouble(buffer,offset+20,2)
    return {type:header.type, points:[this._readOnePoint(buffer,offset+4)],z:zm[0],m:zm[1]};
};



parseFile.prototype._typeMultiPoint=function(buffer,header,offset) { // type===8
    var len=readInt(buffer,offset+36)[0];
    return {type:header.type, bbox:this._readBbox(buffer,offset+4),points:this._readPoints(buffer,offset+40,len)};
};

parseFile.prototype._typePolyLine=function(buffer,header,offset) { // type===3
    var numParts=readInt(buffer,offset+36)[0],numPoints=readInt(buffer,offset+40)[0];
//    console.log(numParts,numPoints);
    return {type:header.type,bbox:this._readBbox(buffer,offset+4),parts:readInt(buffer,offset+44,numParts),points:this._readPoints(buffer,offset+44+numParts*4,numPoints)};
};

parseFile.readers=[
    parseFile.prototype._typeNoShape,parseFile.prototype._typePoint,parseFile.prototype._typeNoShape,parseFile.prototype._typePolyLine,
    parseFile.prototype._typeNoShape,parseFile.prototype._typePolyLine,parseFile.prototype._typeNoShape,
    parseFile.prototype._typeNoShape,parseFile.prototype._typeMultiPoint,parseFile.prototype._typeNoShape,
    parseFile.prototype._typeNoShape,parseFile.prototype._typePointZ
    ];

parseFile.prototype._point2json=function(shape) {
    if (shape.type!==1) {
        return null;
    }
    return {type:"Point",coordinates:[shape.points[0].x,shape.points[0].y]};
};

parseFile.prototype._pointZ2json=function(shape) {
    if (shape.type!==11) {
        return null;
    }
    return {type:"Point",coordinates:[shape.points[0].x,shape.points[0].y],properties:{z:shape.z,m:shape.m}};
};


parseFile.prototype._polyLine2json=function(shape) {
    if (shape.type!==3) {
        return null;
    }
    var coordinates=[];
    shape.parts.forEach((shapeIndex,index,parts)=>{
        var start=shapeIndex,end=index===parts.length-1?shape.points.length:parts[index+1];
        for(var i=shapeIndex;i<end;i+=1) {
            coordinates.push([shape.points[i].x,shape.points[i].y]);    
        }
    });
    if (coordinates.length) {
        return {type:"LineString",coordinates:coordinates};
    }
    return null;
};

parseFile.prototype._pointList2json=function(shape) {
    if (shape.type!==8) {
        return null;
    }
    var coordinates=[];
    shape.points.forEach((point)=>coordinates.push([point.x,point.y]));
    if (coordinates.length) {
        return {type:"MultiPoint",coordinates:coordinates};
    }
    return null;
};

parseFile.prototype._polygon2json=function(shape) {
    if (shape.type!==5) {
        return null;
    }
    var coordinates=[];
    shape.parts.forEach((shapeIndex,index,parts)=>{
        var start=shapeIndex,end=index===parts.length-1?shape.points.length:parts[index+1],polygon=[];
        for(var i=shapeIndex;i<end;i+=1) {
            polygon.push([shape.points[i].x,shape.points[i].y]);    
        }
        if (polygon.length) {
            coordinates.push(polygon);
        }
    });
    if (coordinates.length) {
        return {type:"Polygon",coordinates:coordinates};
    }
    return null;

};


parseFile.convertors=[
    null,parseFile.prototype._point2json,null,parseFile.prototype._polyLine2json,null,
    parseFile.prototype._polygon2json,null,null,parseFile.prototype._pointList2json,
    null,null,parseFile.prototype._pointZ2json
    ];


parseFile.prototype.toString=function() {
    return JSON.stringify(
        {bbox:this.bbox,shapes:this.shapes}
    );
};

parseFile.prototype.toGeoJSON=function(index) {
    var shapes=index===undefined || index<0 || index>this.shapes.length?this.shapes:[this.shapes[index]];
    var bbox=index===undefined || index<0 || index>this.shapes.length?this.bbox:this.shapes[index].bbox;
    var ret={type:"GeometryCollection",geometries:[]};
    shapes.forEach((shape)=>{
        var convertor=parseFile.convertors[shape.type],data;
        if (convertor) {
            if((data=convertor(shape))) {
                if (shape.properties) {
                    data.properties=Object.assign(shape.properties,data.properties);
                }
                ret.geometries.push(data);
            }
        }
    });
    if (ret.geometries.length===1) {
        ret=ret.geometries[0];
    }
    if (bbox) {
        ret.bbox=[bbox[0],bbox[1],bbox[2],bbox[3]]; // south-west and north-east edges
    }
    return ret;
};



module.exports=parseFile;
