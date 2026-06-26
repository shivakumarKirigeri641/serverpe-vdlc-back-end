const express = require(`express`);
const getStatesAndUnions = require("../repos/gets/getStatesAndUnions");
const getSubscriptionDetails = require("../repos/gets/getSubscriptionDetails");
const validateSendOtp = require("../validators/validateSendOtp");
const sendOtp = require("../repos/insertions/sendOtp");
const validateForMobileNumberandOtp=require('../validators/validateForMobileNumberandOtp')
const verifyOtp = require("../repos/insertions/verifyOtp");
const publicRouter = express.Router();
publicRouter.get('/states-unions', async(req, res)=>{
    try {
    const result = await getStatesAndUnions();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/subscription-details', async(req, res)=>{
    try {
    const result = await getSubscriptionDetails();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.post('/send-otp', async(req, res)=>{
    try {
      const validate=validateSendOtp(req);
      if(false === validate.successstatus){
          return res.status(validate.statuscode).json({
              statuscode: validate.statuscode,
              powered_by: "ServerPe App Solutions",
              successstatus: validate.successstatus,
              message: validate.message,
          });
      }
      const result = await sendOtp(validate.data);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.post('/verify-otp', async(req, res)=>{
  try {
    let validatemobileotp=validateForMobileNumberandOtp(req);
    if(false === validatemobileotp.successstatus){
        return res.status(validatemobileotp.statuscode).json({
            statuscode: validatemobileotp.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validatemobileotp.successstatus,
            message: validatemobileotp.message,
        });
    }
    const result = await verifyOtp(validatemobileotp.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
module.exports=publicRouter;