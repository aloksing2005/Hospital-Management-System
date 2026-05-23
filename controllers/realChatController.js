const { Message, User, Doctor, Appointment } = require("../config/db");

// Get chat history between two users
exports.getChatHistory = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.session.user.id;

    const messages = await Message.find({
      $or: [
        { sender_id: currentUserId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: currentUserId }
      ]
    })
    .sort({ created_at: 1 })
    .lean();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    const sender_id = req.session.user.id;

    if (!receiver_id || !message) {
      return res.status(400).json({ success: false, error: "Receiver ID and message are required" });
    }

    const newMessage = await Message.create({
      sender_id,
      receiver_id,
      message
    });

    const io = req.app.get("io");
    
    // Emit to receiver
    io.to(`user_${receiver_id}`).emit("new-message", {
      _id: newMessage._id,
      sender_id,
      receiver_id,
      message,
      created_at: newMessage.created_at
    });

    // Emit to sender for confirmation
    io.to(`user_${sender_id}`).emit("message-sent", {
      _id: newMessage._id,
      sender_id,
      receiver_id,
      message,
      created_at: newMessage.created_at
    });

    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get conversation list (users you've chatted with)
exports.getConversations = async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const userRole = req.session.user.role;

    let conversations = [];

    if (userRole === "patient") {
      // Get doctors patient has chatted with
      const messages = await Message.find({ sender_id: currentUserId })
        .distinct("receiver_id");
      
      const receivedFrom = await Message.find({ receiver_id: currentUserId })
        .distinct("sender_id");

      const allUserIds = [...new Set([...messages, ...receivedFrom])];

      for (const userId of allUserIds) {
        const doctor = await Doctor.findOne({ user_id: userId }).lean();
        if (doctor) {
          const user = await User.findById(userId).lean();
          const lastMessage = await Message.findOne({
            $or: [
              { sender_id: currentUserId, receiver_id: userId },
              { sender_id: userId, receiver_id: currentUserId }
            ]
          }).sort({ created_at: -1 }).lean();

          const unreadCount = await Message.countDocuments({
            sender_id: userId,
            receiver_id: currentUserId,
            read: false
          });

          conversations.push({
            user_id: userId,
            name: user.name,
            doctor_name: doctor.name,
            specialization: doctor.specialization,
            photo: doctor.photo,
            last_message: lastMessage ? lastMessage.message : null,
            last_message_time: lastMessage ? lastMessage.created_at : null,
            unread_count: unreadCount
          });
        }
      }
    } else if (userRole === "doctor") {
      // Get patients doctor has chatted with
      const doctor = await Doctor.findOne({ user_id: currentUserId }).lean();
      if (!doctor) {
        return res.json({ success: true, conversations: [] });
      }

      const messages = await Message.find({ sender_id: currentUserId })
        .distinct("receiver_id");
      
      const receivedFrom = await Message.find({ receiver_id: currentUserId })
        .distinct("sender_id");

      const allUserIds = [...new Set([...messages, ...receivedFrom])];

      for (const userId of allUserIds) {
        const user = await User.findById(userId).lean();
        if (user && user.role === "patient") {
          const lastMessage = await Message.findOne({
            $or: [
              { sender_id: currentUserId, receiver_id: userId },
              { sender_id: userId, receiver_id: currentUserId }
            ]
          }).sort({ created_at: -1 }).lean();

          const unreadCount = await Message.countDocuments({
            sender_id: userId,
            receiver_id: currentUserId,
            read: false
          });

          conversations.push({
            user_id: userId,
            name: user.name,
            last_message: lastMessage ? lastMessage.message : null,
            last_message_time: lastMessage ? lastMessage.created_at : null,
            unread_count: unreadCount
          });
        }
      }
    }

    conversations.sort((a, b) => {
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time) - new Date(a.last_message_time);
    });

    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { sender_id } = req.body;
    const receiver_id = req.session.user.id;

    await Message.updateMany(
      { sender_id, receiver_id, read: false },
      { read: true }
    );

    const io = req.app.get("io");
    io.to(`user_${sender_id}`).emit("messages-read", { receiver_id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const unreadCount = await Message.countDocuments({
      receiver_id: currentUserId,
      read: false
    });

    res.json({ success: true, unread_count: unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
