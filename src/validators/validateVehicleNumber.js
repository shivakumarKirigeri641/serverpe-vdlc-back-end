const validateVehicleNumber = (req) => {
  try {
    const reg_no =
      req?.body?.reg_no ||
      req?.query?.reg_no ||
      req?.headers?.reg_no ||
      req?.body?.vehicle_number ||
      req?.query?.vehicle_number ||
      req?.headers?.vehicle_number;

    if (!reg_no) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "reg_no is required",
        data: null,
      };
    }

    // Normalize: strip spaces/hyphens and uppercase so "ka-01 ab 1234" => "KA01AB1234"
    const cleaned = reg_no
      .toString()
      .replace(/[\s-]+/g, "")
      .toUpperCase();

    // Standard BH (Bharat) series: YY + BH + 4 digits + 1-2 letters. e.g. 22BH1234AA
    const bhSeriesRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

    // Standard format: state(2) + RTO district(2) + series(1-3) + number(4). e.g. KA01AB1234
    const standardRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;

    // Older format: 1-2 digit district code, 0-2 letter series, 1-4 digit number.
    // Covers legacy plates like MH011234, KA9C12, AP1A1.
    const olderRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{1,4}$/;

    let series_type = null;
    if (bhSeriesRegex.test(cleaned)) {
      series_type = "BH";
    } else if (standardRegex.test(cleaned)) {
      series_type = "STANDARD";
    } else if (olderRegex.test(cleaned)) {
      series_type = "OLDER";
    }

    if (!series_type) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid vehicle number format",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Vehicle number validated successfully",
      data: {
        reg_no: cleaned,
        series_type,
      },
    };
  } catch (error) {
    console.error("Vehicle number validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateVehicleNumber;
