# shpFile
Very simple ESRI SHP file to GeoJSON convertor. In fact parse subset of ESRI SHP. Now parsed next type of shapes:
*  0 Null shape
*  1 Point
*  3 PolyLine
*  5 Polygon
*  8 MultiPoint
* 11 PointZ
* 15 PolygonZ

# Installation

```
npm install --save https://github.com/mvtm-dn/shpFile.git
```


# usage

Example of usage:

```
    const shapeFile=require("shpFile");

    let geoJSONs=[];
    shapeFile(filename).on("error",(error)=>{
        console.log("Error open %s - %s",filename,error);
    })
    .on("end",(shapes)=>{
        console.log("Got %d shape(s)",shapes.length);
        for(let i=0;i<this.length;i+=1) {
            geoJSONs.push(shapes.toGeoJSON(i));,
        }
    });
    
```
## shapeFile object
### methods

`shapeFile(sources[,translate[,filter]])` Create parser object and start parsing shape file. Parameters
* `sources` - either name of shape file or list `["name of shape file", "name of dbf file"]`
* `translate` - `proj4(..)` instance. Can be omitted. 
* `filter` - filter expression. If filter(shape)===false then shape don't append at resulting list

`length` - returns numbers of readed objects
`toString()` - returns string representation of shape file as a javascript Object
`toGeoJSON([index])` - returns [GeoJSON](http://geojson.org/) representation of either of one of shape file object or all shapefile objects. 

### events
`error` - emitted when the any error throws during parsing file. Passes along throwed error
`end`  - emitted when shapes successfully parsed. Passes along shapeFile object reference.

### shapes
`shapeObject.shapes` is an array of parsed shapes. 

|Field | Value | Present in|
|------|:-------:|:--------:|
|type  | type of shape| 0,1,3,5,8,11,15|
|points|array of points|1,3,5,8,11,15|
|bbox  |bounding box|3,5,8,15|
|parts |list of parts|3,5,15|
|z|z value|11|
|z|array of z values|15
|m|m value|11|
|zmin,zmax|zmin and zmax|15|
### TODO
TODO List
* Extract m values for polylineZ
* Parse rest of shape types

