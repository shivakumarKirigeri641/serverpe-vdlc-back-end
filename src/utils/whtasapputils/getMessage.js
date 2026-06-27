const getMessage=(payload)=>{
        return payload?.entry?.[0]
        ?.changes?.[0]
        ?.value
        ?.messages?.[0];
}
module.exports=getMessage;