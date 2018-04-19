# shpFile
Very simple ESRI SHP file to GeoJSON convertor. In fact parse subset of ESRI SHP. Now parsed next type of shapes:
*  0 Null shape
*  1 Point
*  3 PolyLine
*  5 Polygon
*  8 MultiPoint
* 11 PointZ

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
        console.log("Error open {0} - {1}".format(shapeSource,error));
    })
    .on("end",(shapes){
        console.log("Got {0} shape(s)".format(shapes.length));
        for(let i=0;i<this.length;i+=1) {
            geoJSONs.push(this.toGeoJSON(i));,
        }
    });
    
```
## shapeFile object
### methods

`shapeFile(sources[,translate])` Create parser object and start parsing shape file. Parameters
* `sources` - either name of shape file or list `["name of shape file", "name of dbf file"]`
* `translate` - `proj4(..)` instance. Can be omitted. 

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
|type  | type of shape| 0,1,3,5,8,11|
|points|array of points|1,3,5,8,11|
|bbox  |bounding box|3,5,8|
|parts |list of parts| 8|

### TODO
TODO List
* Parse rest of shape types

