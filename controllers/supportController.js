import SupportTicket from "../models/support.js"

export const submitSupportTicket = async (req, res) => {
  try {
    const userId = req.user._id;
    const { email, issueType, subject, message } = req.body;

    if (!email || !issueType || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const ticket = await SupportTicket.create({
      userId,
      email,
      issueType,
      subject,
      message,
    });

    res.status(201).json({
      message: "Support ticket submitted successfully.",
      ticket,
    });
  } catch (err) {
    console.error("submitSupportTicket error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id;

    const tickets = await SupportTicket.find({ userId })
      .sort({ createdAt: -1 });

    res.json({ tickets });
  } catch (err) {
    console.error("getMyTickets error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json({ tickets });
  } catch (err) {
    console.error("getAllTickets error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};