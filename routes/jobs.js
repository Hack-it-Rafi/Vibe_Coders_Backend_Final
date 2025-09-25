const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const router = express.Router();

const jobsPath = path.join(__dirname, "../data/jobs.json");
const profilesPath = path.join(__dirname, "../data/profiles.json");

// Configure multer for CV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/cvs");
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `cv-${uniqueSuffix}${ext}`);
  },
});

// File filter to allow only PDF and DOC files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only PDF and DOC/DOCX files are allowed."),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.get("/", (req, res) => {
  const jobs = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
  res.json(jobs);
});

// Modified apply route to handle both job application and CV upload
router.post("/apply", upload.single("cv"), (req, res) => {
  try {
    const { jobId, accountLabel } = req.body || {};
    console.log("Apply request - jobId:", jobId, "accountLabel:", accountLabel);
    console.log("CV file:", req.file);

    if (!jobId || !accountLabel) {
      return res.status(400).json({ error: "Missing jobId or accountLabel" });
    }

    let profiles = {};
    if (fs.existsSync(profilesPath)) {
      profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
    }

    if (!profiles[accountLabel]) {
      profiles[accountLabel] = { appliedJobs: [], cvs: [] };
    }

    // Initialize cvs array if doesn't exist
    if (!profiles[accountLabel].cvs) {
      profiles[accountLabel].cvs = [];
    }

    // Add job to applied jobs if not already applied
    if (!profiles[accountLabel].appliedJobs.includes(parseInt(jobId))) {
      profiles[accountLabel].appliedJobs.push(parseInt(jobId));
    }

    let cvData = null;
    // Handle CV upload if file is provided
    if (req.file) {
      cvData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        uploadDate: new Date().toISOString(),
        jobId: parseInt(jobId),
        size: req.file.size,
      };
      profiles[accountLabel].cvs.push(cvData);
    }

    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

    const response = {
      success: true,
      profile: profiles[accountLabel],
      message: "Application submitted successfully",
    };

    if (cvData) {
      response.cv = cvData;
      response.message += " with CV uploaded";
    }

    res.json(response);
  } catch (error) {
    console.error("Application error:", error);
    res.status(500).json({ error: "Failed to process application" });
  }
});

router.get("/applied/:accountLabel", (req, res) => {
  const { accountLabel } = req.params;

  const jobs = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));

  const appliedJobIds = profiles[accountLabel]?.appliedJobs || [];
  const appliedJobs = jobs.filter((job) => appliedJobIds.includes(job.id));

  res.json(appliedJobs);
});

// New route for uploading CVs
router.post("/upload-cv", upload.single("cv"), (req, res) => {
  try {
    const { accountLabel, jobId } = req.body;

    if (!accountLabel) {
      return res.status(400).json({ error: "Account label is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No CV file uploaded" });
    }

    // Read or create profiles data
    let profiles = {};
    if (fs.existsSync(profilesPath)) {
      profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
    }

    // Initialize profile if doesn't exist
    if (!profiles[accountLabel]) {
      profiles[accountLabel] = { appliedJobs: [], cvs: [] };
    }

    // Initialize cvs array if doesn't exist
    if (!profiles[accountLabel].cvs) {
      profiles[accountLabel].cvs = [];
    }

    // Store CV information
    const cvData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadDate: new Date().toISOString(),
      jobId: jobId || null, // Optional job association
      size: req.file.size,
    };

    profiles[accountLabel].cvs.push(cvData);

    // Save updated profiles
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

    res.json({
      success: true,
      message: "CV uploaded successfully",
      cv: cvData,
    });
  } catch (error) {
    console.error("CV upload error:", error);
    res.status(500).json({ error: "Failed to upload CV" });
  }
});

// New route to get CVs for a specific account
router.get("/cvs/:accountLabel", (req, res) => {
  try {
    const { accountLabel } = req.params;

    if (!fs.existsSync(profilesPath)) {
      return res.json({ cvs: [] });
    }

    const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
    const userProfile = profiles[accountLabel];

    if (!userProfile || !userProfile.cvs) {
      return res.json({ cvs: [] });
    }

    res.json({ cvs: userProfile.cvs });
  } catch (error) {
    console.error("Error fetching CVs:", error);
    res.status(500).json({ error: "Failed to fetch CVs" });
  }
});

// New route to download a specific CV
router.get("/download-cv/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../uploads/cvs", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "CV file not found" });
    }

    res.download(filePath);
  } catch (error) {
    console.error("CV download error:", error);
    res.status(500).json({ error: "Failed to download CV" });
  }
});

module.exports = router;
