const qs = require('qs');
const assert = require('assert');
const express=require('express');
const bodyParser=require('body-parser');
const fs=require('fs');
const request=require('request');
const cheerio=require('cheerio');
const app=express();
const cors=require('cors');
const _=require('lodash');
const moment=require('moment');
const mysql=require('mysql');
const deferred=require('./defer');
const config=require('./config.json');

var router=express.Router();
var port=process.env.PORT||config._port;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, PUT, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    res.setHeader('X-Powered-By', 'artha prihardana');
    next();
});

var connection = mysql.createConnection({
    host     : config._mysql.host,
    user     : config._mysql.user,
    password : config._mysql.password,
    database : config._mysql.database
});

var scrp=function(baseurl, prm, tgl, cb) {
  // params=Object.assign({}, prm);
  var params=clone(prm);
  delete params.dariTanggal;
  delete params.sampaiTanggal;
  params.culture="id-ID";
  params.s=true;
  params.mon=true;
  params.cc="IDR";
  params.c=false;
  params.dd1=tgl;
  var _baseurl=baseurl+qs.stringify(params);
  request(_baseurl, function(error, response, html){
    try {
      if(error) {
        res.json(error);
      }
      var schema={};
      var dt=[];
      var dtt={};
      var clearspace=/\r?\n?\s|\r/g; // cek \r \n \s
      var $ = cheerio.load(html);
      var jadwal="";
      var r="";
        var atbdata=[];
      $('.js_availability_container').filter(function() {
        var data = $(this);
        jadwal=data.children().first().children().first().text();
        r=jadwal.replace(clearspace,"");
        var find=data.find('.avail-table-bold');  // origin -> destination
        var price=data.find('.avail-fare-price-container'); // price
        var wkt=data.find('.avail-stops-info .text-center'); // waktu tempuh
        var ff=_.chunk(find,2);
        var pp=(params.CHD>0) ? _.chunk(price,2) : _.chunk(price,1);
        var ee=_.chunk(wkt,2);
        var jj=[];
        for(var j=0;j<ff.length;j++) {
          var b=ff[j];
          var c=pp[j];
          var y=ee[j];
          var cc=c[0].children[1].children[1].children[1].children[0].data; // price dewasa
          var dd=(params.CHD>0) ? c[1].children[1].children[1].children[1].children[0].data : ''; // price anak
          var yy=y[1].children[0].data; // waktu tempuh
          var ccc=cc.replace(clearspace,"");
          var ddd=(params.CHD>0) ? dd.replace(clearspace,"") : '';
          var x={};
          /** sql */
            var tbdata={};
            tbdata["tanggal"]=tgl;
            tbdata["origin"]=params.o1;
            tbdata["destination"]=params.d1;
            tbdata["currency"]=params.cc;
            tbdata["jamBerangkat"]=b[0].children[0].data;
            tbdata["jamTiba"]=b[1].children[0].data;
            tbdata["hargaDewasa"]=ccc;
            if(params.CHD>0) {
                tbdata["hargaAnak"]=ddd;
            }
            tbdata["waktuTempuh"]=yy;
          /** sql */
          atbdata.push(tbdata);
        }
      });
      cb(null, atbdata);
    } catch (e) {
      cb(e);
    }
  });
}
var clone=function(item) {
  if (!item) { return item; } // null, undefined values check

  var types = [ Number, String, Boolean ], 
      result;

  types.forEach(function(type) {
      if (item instanceof type) {
          result = type( item );
      }
  });

  if (typeof result == "undefined") {
      if (Object.prototype.toString.call( item ) === "[object Array]") {
          result = [];
          item.forEach(function(child, index, array) { 
              result[index] = clone( child );
          });
      } else if (typeof item == "object") {
          if (item.nodeType && typeof item.cloneNode == "function") {
              var result = item.cloneNode( true );    
          } else if (!item.prototype) { // check that this is a literal
              if (item instanceof Date) {
                  result = new Date(item);
              } else {
                  result = {};
                  for (var i in item) {
                      result[i] = clone( item[i] );
                  }
              }
          } else {
              if (false && item.constructor) {
                  result = new item.constructor();
              } else {
                  result = item;
              }
          }
      } else {
          result = item;
      }
  }
  return result;
}

router.route('/')
  .get(function(req, res) {
    res.json({ message: 'welcome' });
    res.end();
});
router.route('/scrape')
  .get(function(req, res){
    var params=req.query;
    if(params.ADT > 0) {
      // var _baseurl='https://booking.airasia.com/Flight/Select?'+qs.stringify(params);
      var _baseurl='https://booking.airasia.com/Flight/Select?';
      var aschema=[];
      var acb=[];
      var tgl=[];
      var cnt=0;
      for(var i=moment(params.dariTanggal);i.isSameOrBefore(moment(params.sampaiTanggal));i.add(1,'days')) {
        cnt+=1;
        tgl.push(i.format("YYYY-MM-DD"));
      }
      if(tgl.length==cnt) {
        tgl.forEach(function(v) {
          acb.push(function(){
            var _this=this;
            scrp(_baseurl,params,v,function(e,dt) {
              aschema.push(dt);
              if (e) {
                _this.reject(e);
              } else {
                _this.resolve();
              }
            });
          });

        });
        var def=deferred(acb)
          .catch(function(e){
            res.status(e);
          })
          .done(function(){
            //connection.connect();
            for(var i=0;i<aschema.length;i++) {
                var step2=aschema[i];
                for(var j=0;j<step2.length;j++) {
                    var query = connection.query('INSERT INTO data SET ?', step2[j], function(err, result) {
                        // Neat! 
                    });
                    console.log(query.sql);
                }
            }
            //connection.end();
            res.json(aschema);
            res.end();
          });
      }
    } else {
      res.json({message:"ada field kosong"});
      res.end();
    }
  });
  
app.use('/api',router);
app.listen(port)
console.log('Mulai di port '+port);
