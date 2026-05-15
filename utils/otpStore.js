const otpMap = new Map();

module.exports = {
  setOTP: (email, otp) => {
    otpMap.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });
  },

  verifyOTP: (email, otp) => {
    const data = otpMap.get(email);
    if (!data) return false;

    if (data.otp === otp && Date.now() < data.expires) {
      otpMap.delete(email);
      return true;
    }

    return false;
  }
};
