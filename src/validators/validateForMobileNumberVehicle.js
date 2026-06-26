const validateForMobileNumber = require("./validateMoibleNumber");
const validateVehicleNumber = require("./validateVehicleNumber");

/**
 * Validates a request body carrying a mobile + vehicle number, e.g.
 * { "mobile_number": "9886122415", "vehicle_number": "ka02ex1480" }
 *
 * Used by trial activation, where the plan is implicit (always the trial plan)
 * so no plan_id is required. Returns normalized { mobile_number, reg_no }.
 */
const validateForMobileNumberVehicle = (req) => {
  try {
    const mobileResult = validateForMobileNumber(req);
    if (false === mobileResult.successstatus) {
      return mobileResult;
    }

    const vehicleResult = validateVehicleNumber(req);
    if (false === vehicleResult.successstatus) {
      return vehicleResult;
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Mobile number and vehicle number validated successfully",
      data: {
        mobile_number: mobileResult.data.mobile_number,
        reg_no: vehicleResult.data.reg_no,
      },
    };
  } catch (error) {
    console.error("Mobile/Vehicle validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForMobileNumberVehicle;
