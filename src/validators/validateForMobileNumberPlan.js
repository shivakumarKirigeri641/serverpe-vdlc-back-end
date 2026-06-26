const validateForMobileNumber = require("./validateMoibleNumber");
const validateVehicleNumber = require("./validateVehicleNumber");

/**
 * Validates the /activate-trial-plan request body, e.g.
 * { "mobile_number": "9886122415", "vehicle_number": "ka02ex1480", "plan_id": 1 }
 *
 * Reuses the mobile and vehicle validators, then checks plan_id is a positive
 * integer. Returns normalized { mobile_number, reg_no, plan_id } on success.
 */
const validateForMobileNumberPlan = (req) => {
  try {
    const mobileResult = validateForMobileNumber(req);
    if (false === mobileResult.successstatus) {
      return mobileResult;
    }

    const vehicleResult = validateVehicleNumber(req);
    if (false === vehicleResult.successstatus) {
      return vehicleResult;
    }

    const rawPlanId =
      req?.body?.plan_id ?? req?.query?.plan_id ?? req?.headers?.plan_id;

    const plan_id = Number(rawPlanId);
    if (
      rawPlanId === undefined ||
      rawPlanId === null ||
      rawPlanId === "" ||
      !Number.isInteger(plan_id) ||
      plan_id <= 0
    ) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "plan_id is required and must be a positive integer",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Mobile number, vehicle number and plan validated successfully",
      data: {
        mobile_number: mobileResult.data.mobile_number,
        reg_no: vehicleResult.data.reg_no,
        plan_id,
      },
    };
  } catch (error) {
    console.error("Mobile/Vehicle/Plan validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForMobileNumberPlan;
