import {db} from './firebase.js';
import {collection,doc,getDoc,getDocs,query,orderBy,limit,setDoc,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {normalize,slugify} from './utils.js';
export async function listPosts(max=200){const s=await getDocs(query(collection(db,'posts'),orderBy('updatedAt','desc'),limit(max)));return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status!=='draft');}
export async function getPost(id){const s=await getDoc(doc(db,'posts',id));return s.exists()?{id:s.id,...s.data()}:null;}
export async function listSkills(max=1000){const s=await getDocs(query(collection(db,'wikiSkills'),orderBy('updatedAt','desc'),limit(max)));return s.docs.map(d=>({id:d.id,...d.data()}));}
export function postKey(r){return r.id?.trim()||slugify(r.slug||r.title||crypto.randomUUID());}
export function skillKey(r){return r.id?.trim()||slugify(r.skillId||r.name||crypto.randomUUID());}
export async function importRows(type,rows,onProgress=()=>{}){const collectionName=type==='blog'?'posts':'wikiSkills';const keyFn=type==='blog'?postKey:skillKey;let created=0,updated=0,skipped=0;for(let start=0;start<rows.length;start+=400){const part=rows.slice(start,start+400);const batch=writeBatch(db);for(const raw of part){const id=keyFn(raw);if(!id){skipped++;continue}const ref=doc(db,collectionName,id);const exists=(await getDoc(ref)).exists();const base={...raw,id,searchKey:normalize(type==='blog'?raw.title:raw.name),updatedAt:serverTimestamp()};if(!exists)base.createdAt=serverTimestamp();batch.set(ref,base,{merge:true});exists?updated++:created++;}await batch.commit();onProgress(Math.min(start+part.length,rows.length),rows.length);}return{created,updated,skipped};}
