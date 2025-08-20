import User from "../src/models/userSchema.js";

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Use the User model, not req.user
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.isVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    if (
      user.verificationToken !== code ||
      user.verificationTokenExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification code" });
    }

    // Update user as verified
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
