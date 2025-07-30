import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    jobId: String,
    type: String,
    userId: String,
    status: String,
    details: Object,
    timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog