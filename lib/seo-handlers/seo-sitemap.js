const {config,xmlEscape,loadSource,itemDate,dynamicUrl,setCommonHeaders}=require("../mina-seo-utils");
function row({loc,lastmod="",changefreq="weekly",priority=0.7}){return `  <url>
    <loc>${xmlEscape(loc)}</loc>
${lastmod?`    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`:""}    <changefreq>${xmlEscape(changefreq)}</changefreq>
    <priority>${Number(priority).toFixed(1)}</priority>
  </url>`}
module.exports=async function handler(req,res){if(req.method!=="GET"&&req.method!=="HEAD"){res.setHeader("Allow","GET, HEAD");return res.status(405).end("Method Not Allowed")}try{const urls=new Map();for(const page of config.staticPages){const loc=new URL(page.path,config.site.origin).href;urls.set(loc,{loc,changefreq:page.changefreq||"weekly",priority:page.priority??0.7})}if(config.sitemap.includeDynamicQueryUrls){for(const source of Object.values(config.sources)){const items=await loadSource(req,source);for(const item of items){const loc=dynamicUrl(item,source);if(!loc)continue;urls.set(loc,{loc,lastmod:itemDate(item,source),changefreq:"weekly",priority:0.7});if(urls.size>=config.sitemap.maxUrls)break}}}const body=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls.values()].map(row).join("\n")}
</urlset>
`;setCommonHeaders(res,"application/xml",config.sitemap.cacheSeconds);res.setHeader("X-Robots-Tag","noindex");return res.status(200).send(req.method==="HEAD"?"":body)}catch(error){console.error(error);setCommonHeaders(res,"application/xml",0);return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><error>${xmlEscape(error.message)}</error>`)}};
