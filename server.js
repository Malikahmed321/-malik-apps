const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, 'uploads');
const DATA = path.join(ROOT, 'apps.json');

fs.mkdirSync(UPLOADS, { recursive: true });

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(DATA, '[]');
}

const read = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8'));
  } catch {
    return [];
  }
};

const save = (data) => {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },

  filename: (req, file, cb) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 500 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    const allowed = [
      '.apk',
      '.ipa',
      '.png',
      '.jpg',
      '.jpeg',
      '.webp'
    ];

    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(
        'Only APK, IPA and image files are allowed.'
      ));
    }
  }
});


app.use(express.json());

app.use(
  express.static(
    path.join(ROOT, 'public')
  )
);

app.use(
  '/uploads',
  express.static(UPLOADS)
);


/* Get applications */

app.get('/api/apps', (req, res) => {

  const apps = read().map(appItem => ({
    ...appItem,

    downloadUrl:
      '/uploads/' +
      encodeURIComponent(appItem.fileName)
  }));

  res.json(apps);
});


/* Upload application */

app.post(
  '/api/apps',

  upload.fields([
    {
      name: 'appFile',
      maxCount: 1
    },
    {
      name: 'icon',
      maxCount: 1
    }
  ]),

  (req, res) => {

    try {

      if (req.body.password !== ADMIN_PASSWORD) {

        return res.status(401).json({
          error: 'Wrong admin password.'
        });

      }

      const file =
        req.files?.appFile?.[0];

      const icon =
        req.files?.icon?.[0];


      if (!file) {

        return res.status(400).json({
          error: 'Choose an APK or IPA file.'
        });

      }


      const ext =
        path.extname(
          file.originalname
        ).toLowerCase();


      if (
        ext !== '.apk' &&
        ext !== '.ipa'
      ) {

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        if (
          icon &&
          fs.existsSync(icon.path)
        ) {
          fs.unlinkSync(icon.path);
        }

        return res.status(400).json({
          error:
            'The app file must be .apk or .ipa.'
        });

      }


      const item = {

        id: Date.now().toString(),

        name:
          (req.body.name || 'Unnamed App')
          .trim(),

        version:
          (req.body.version || '1.0')
          .trim(),

        description:
          (req.body.description || '')
          .trim(),

        type:
          ext
            .slice(1)
            .toUpperCase(),

        fileName:
          path.basename(file.filename),

        originalFileName:
          file.originalname,

        iconFileName:
          icon
            ? path.basename(icon.filename)
            : null,

        createdAt:
          new Date().toISOString()
      };


      const apps = read();

      apps.unshift(item);

      save(apps);


      res.json({
        ok: true,
        app: item
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);


/* Error handler */

app.use(
  (error, req, res, next) => {

    res.status(400).json({
      error:
        error.message ||
        'Upload error.'
    });

  }
);


/* Start server */

app.listen(
  PORT,
  () => {
    console.log(
      'MALIK APPS: http://localhost:' + PORT
    );
  }
);