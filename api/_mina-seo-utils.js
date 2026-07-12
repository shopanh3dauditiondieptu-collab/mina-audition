const config = require("../seo/mina-seo.config");
function absoluteUrl(value, origin = config.site.origin){try{return new URL(String(value||"/"),origin).href}catch{return origin+"/"}}
function xmlEscape(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;")}
function cleanText(value,max=180){return String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function firstValue(item,keys=[]){for(const key of keys){const value=item&&item[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return value}return""}
function unwrapCollection(payload,keys=[]){if(Array.isArray(payload))return payload;for(const key of keys)if(Array.isArray(payload?.[key]))return payload[key];return[]}
async function fetchJsonFromOrigin(req,endpoint){const proto=req.headers["x-forwarded-proto"]||"https";const host=req.headers["x-forwarded-host"]||req.headers.host;const origin=host?`${proto}://${host}`:config.site.origin;const response=await fetch(absoluteUrl(endpoint,origin),{headers:{Accept:"application/json","User-Agent":"MinaSEO/2.0"},signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error(`${endpoint}: HTTP ${response.status}`);return response.json()}
async function loadSource(req,source){if(!source?.enabled)return[];for(const endpoint of source.endpoints||[]){try{const payload=await fetchJsonFromOrigin(req,endpoint);const list=unwrapCollection(payload,source.collectionKeys);if(list.length)return list}catch(error){console.warn("[Mina SEO] Bỏ qua nguồn",endpoint,error.message)}}return[]}
function itemId(item,source){return cleanText(firstValue(item,source.idKeys),160)}
function itemDate(item,source){const raw=firstValue(item,source.dateKeys);const date=raw?new Date(raw):null;return date&&!Number.isNaN(date.getTime())?date.toISOString():""}
function dynamicUrl(item,source){const id=itemId(item,source);if(!id)return"";const url=new URL(source.pagePath,config.site.origin);url.searchParams.set(source.itemParam,id);return url.href}
function setCommonHeaders(res,contentType,cacheSeconds=0){res.setHeader("Content-Type",`${contentType}; charset=utf-8`);res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Cache-Control",cacheSeconds>0?`public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds*2}`:"no-store")}
module.exports={config,absoluteUrl,xmlEscape,cleanText,firstValue,loadSource,itemId,itemDate,dynamicUrl,setCommonHeaders};
