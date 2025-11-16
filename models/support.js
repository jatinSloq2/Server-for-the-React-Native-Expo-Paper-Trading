import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    issueType: { type: String, required: true }, // Bug, Payment, Account, Other
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      default: "OPEN",
    },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("SupportTicket", supportTicketSchema);