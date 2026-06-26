const validateForMobileNumber = require("./validateMoibleNumber");
const validateVehicleNumber = require("./validateVehicleNumber");

/**
 * Validates the /send-otp request body, e.g.
 * { "mobile_number": "9886122415", "vehicle_number": "ka02ex1480", "states_unions_id": 11 }
 *
 * Reuses the mobile and vehicle validators, returning the normalized values
 * (cleaned mobile_number + uppercased reg_no + states_unions_id) on success.
 */
const validateSendOtp = (req) => {
  try {
    const mobileResult = validateForMobileNumber(req);
    if (false === mobileResult.successstatus) {
      return mobileResult;
    }

    const vehicleResult = validateVehicleNumber(req);
    if (false === vehicleResult.successstatus) {
      return vehicleResult;
    }

    const rawStateId =
      req?.body?.states_unions_id ??
      req?.query?.states_unions_id ??
      req?.headers?.states_unions_id;

    const states_unions_id = Number(rawStateId);
    if (
      rawStateId === undefined ||
      rawStateId === null ||
      rawStateId === "" ||
      !Number.isInteger(states_unions_id) ||
      states_unions_id <= 0
    ) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "states_unions_id is required and must be a positive integer",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Send OTP request validated successfully",
      data: {
        mobile_number: mobileResult.data.mobile_number,
        reg_no: vehicleResult.data.reg_no,
        series_type: vehicleResult.data.series_type,
        states_unions_id,
      },
    };
  } catch (error) {
    console.error("Send OTP validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateSendOtp;
