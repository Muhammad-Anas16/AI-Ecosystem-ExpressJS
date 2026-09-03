export async function readScreen(req,res){
 if(!req.file)return res.status(400).json({error:"image is required"});
 res.status(501).json({error:"OCR adapter not enabled",note:"Install tesseract.js and implement recognition here."});
}