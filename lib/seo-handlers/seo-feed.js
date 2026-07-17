const {config,xmlEscape,cleanText,firstValue,loadSource,itemDate,dynamicUrl,setCommonHeaders}=require("../mina-seo-utils");
module.exports=async function handler(req,res){if(!config.feed.enabled)return res.status(404).end("Feed disabled");if(req.method!=="GET"&&req.method!=="HEAD"){res.setHeader("Allow","GET, HEAD");return res.status(405).end("Method Not Allowed")}const source=config.sources.blog;const items=(await loadSource(req,source)).map(item=>({item,url:dynamicUrl(item,source),date:itemDate(item,source)})).filter(x=>x.url).sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0)).slice(0,config.feed.maxItems);const rssItems=items.map(({item,url,date})=>{const title=cleanText(firstValue(item,source.titleKeys),160)||"Bài viết Mina";const description=cleanText(firstValue(item,source.descriptionKeys),500)||"Nội dung mới từ Mina Audition";return `    <item>
      <title>${xmlEscape(title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <description>${xmlEscape(description)}</description>
${date?`      <pubDate>${new Date(date).toUTCString()}</pubDate>\n`:""}    </item>`});const body=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${xmlEscape(config.feed.title)}</title>
<link>${xmlEscape(config.site.origin+"/blog.html")}</link>
<description>${xmlEscape(config.feed.description)}</description>
<language>${xmlEscape(config.site.language)}</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems.join("\n")}
</channel></rss>
`;setCommonHeaders(res,"application/rss+xml",config.sitemap.cacheSeconds);res.setHeader("X-Robots-Tag","noindex");return res.status(200).send(req.method==="HEAD"?"":body)};
