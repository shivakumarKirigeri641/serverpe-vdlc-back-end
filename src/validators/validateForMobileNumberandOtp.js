const validateForMobileNumber = require("./validateMoibleNumber");

/**
 * Validates the /verify-otp request body, e.g.
 * { "mobile_number": "9886122415", "otp": "1234" }
 *
 * Reuses the mobile validator, then checks the OTP is a 4-10 digit numeric code.
 * Returns the normalized { mobile_number, otp } on success.
 */
const validateForMobileNumberandOtp = (req) => {
  try {
    const mobileResult = validateForMobileNumber(req);
    if (false === mobileResult.successstatus) {
      return mobileResult;
    }

    const otp = (
      req?.body?.otp ||
      req?.query?.otp ||
      req?.headers?.otp ||
      ""
    )
      .toString()
      .trim();

    if (!otp) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "otp is required",
        data: null,
      };
    }

    if (!/^\d{4,10}$/.test(otp)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid otp format",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Mobile number and OTP validated successfully",
      data: {
        mobile_number: mobileResult.data.mobile_number,
        vehicle_number: mobileResult.data.vehicle_number,
        otp,
      },
    };
  } catch (error) {
    console.error("Mobile/OTP validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForMobileNumberandOtp;
