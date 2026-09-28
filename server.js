const express=require('express');
const multer=require('multer');
const fs=require('fs');
const path=require('path');

const app=express();
const PORT=process.env.PORT || 3000;

const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD || '1234';
const ROOT=__dirname;
const UPLOADS=path.join(ROOT,'uploads');
const DATA=path.join(ROOT,'apps.json');

fs.mkdirSync(UPLOADS,{recursive:true});
if(!fs.existsSync(DATA)) fs.writeFileSync(DATA,'[]');

const read=()=>{
  try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}
  catch{return[]}
};

const save=x=>fs.writeFileSync(DATA,JSON.stringify(x,null,2));

const storage=multer.diskStorage({
  destination:(r,f,c)=>c(null,UPLOADS),
  filename:(r,f,c)=>c(null,Date.now()+'-'+path.basename(f.originalname).replace(/[^a-zA-Z0-9._-]/g,'_'))
});

const upload=multer({
  storage,
  limits:{fileSize:500*1024*1024},
  fileFilter:(r,f,c)=>{
    const e=path.extname(f.originalname).toLowerCase();
    c(['.apk','.ipa','.png','.jpg','.jpeg','.webp'].includes(e)
      ? null
      : new Error('Only APK, IPA and image files are allowed.'));
  }
});

app.use(express.json());
app.use(express.static(path.join(ROOT,'public')));
app.use('/uploads',express.static(UPLOADS));

app.get('/api/apps',(r,s)=>
  s.json(read().map(a=>({
    ...a,
    downloadUrl:'/uploads/'+encodeURIComponent(a.fileName)
  })))
);

app.post('/api/apps',
  upload.fields([
    {name:'appFile',maxCount:1},
    {name:'icon',maxCount:1}
  ]),
  (r,s)=>{
    try{
      if(r.body.password!==ADMIN_PASSWORD)
        return s.status(401).json({error:'Wrong admin password.'});

      const f=r.files?.appFile?.[0];
      const icon=r.files?.icon?.[0];

      if(!f)
        return s.status(400).json({error:'Choose an APK or IPA file.'});

      const e=path.extname(f.originalname).toLowerCase();

      if(!['.apk','.ipa'].includes(e)){
        fs.unlinkSync(f.path);
        if(icon) fs.unlinkSync(icon.path);
        return s.status(400).json({error:'The app file must be .apk or .ipa.'});
      }

      const item={
        id:Date.now().toString(),
        name:(r.body.name||'Unnamed App').trim(),
        version:(r.body.version||'1.0').trim(),
        description:(r.body.description||'').trim(),
        type:e.slice(1).toUpperCase(),
        fileName:path.basename(f.filename),
        originalFileName:f.originalname,
        iconFileName:icon?path.basename(icon.filename):null,
        createdAt:new Date().toISOString()
      };

      const a=read();
      a.unshift(item);
      save(a);

      s.json({ok:true,app:item});
    }catch(e){
      s.status(500).json({error:e.message});
    }
  }
);

app.use((e,r,s,n)=>
  s.status(400).json({error:e.message||'Upload error.'})
);

app.listen(PORT,'0.0.0.0',()=>{
  console.log('MALIK APPS running on port '+PORT);
});