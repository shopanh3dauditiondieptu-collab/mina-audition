import {
 collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
 query, orderBy, limit, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export class EnterpriseRepository {
 constructor(db){this.db=db;this.posts=collection(db,"posts");this.categories=collection(db,"categories")}
 async listPosts(max=500){let s;try{s=await getDocs(query(this.posts,orderBy("updatedAt","desc"),limit(max)))}catch{s=await getDocs(this.posts)}return s.docs.map(d=>({id:d.id,...d.data()}))}
 async getPost(id){const s=await getDoc(doc(this.db,"posts",id));if(!s.exists())throw new Error("Không tìm thấy nội dung.");return{id:s.id,...s.data()}}
 async savePost(payload,id=""){const data={...payload,cmsVersion:"mina-cms-v4-enterprise",updatedAt:serverTimestamp()};if(id){await updateDoc(doc(this.db,"posts",id),data);return id}const created=await addDoc(this.posts,{...data,createdAt:serverTimestamp()});return created.id}
 async deletePost(id){await deleteDoc(doc(this.db,"posts",id))}
 async listCategories(){let s;try{s=await getDocs(query(this.categories,orderBy("name","asc")))}catch{s=await getDocs(this.categories)}return s.docs.map(d=>({id:d.id,...d.data()}))}
 async saveCategory(payload){return (await addDoc(this.categories,{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})).id}
 async deleteCategory(id){await deleteDoc(doc(this.db,"categories",id))}
 async loadSettings(){const s=await getDoc(doc(this.db,"cmsSettings","general"));return s.exists()?s.data():{}}
 async saveSettings(payload){await setDoc(doc(this.db,"cmsSettings","general"),{...payload,updatedAt:serverTimestamp()},{merge:true})}
}
