const { supabaseAdmin } = require('../config/supabase');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (we'll upload to Supabase)
const storage = multer.memoryStorage();

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('memes')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ message: 'Error uploading file to storage' });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('memes')
      .getPublicUrl(filePath);

    const fileInfo = {
      filename: fileName,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: urlData.publicUrl,
      path: filePath,
      uploadedAt: new Date().toISOString()
    };

    // Store file metadata for use in meme creation
    req.fileUrl = urlData.publicUrl;
    req.fileMetadata = {
      mimetype: file.mimetype,
      size: file.size,
      originalName: file.originalname
    };

    res.status(201).json({
      message: 'File uploaded successfully',
      file: fileInfo
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = `uploads/${filename}`;

    const { error } = await supabaseAdmin.storage
      .from('memes')
      .remove([filePath]);

    if (error) {
      return res.status(404).json({ message: 'File not found or error deleting' });
    }

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
};

module.exports = {
  upload,
  uploadFile,
  deleteFile
};