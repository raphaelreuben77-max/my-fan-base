
const express=require("express"); const {pool,cardNumber}=require("./membership"); const auth=require("../middleware/auth"); const admin=require("../middleware/admin");
const router=express.Router(); router.use(auth,admin);
router.get("/memberships",async(req,res)=>{const r=await pool.query(`SELECT m.*,u.id AS user_id,u.name,u.email,c.card_number,b.total_uses,b.used_count,p.status AS channel_status FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN top_fan_cards c ON c.membership_id=m.id LEFT JOIN show_benefits b ON b.membership_id=m.id LEFT JOIN private_channel_access p ON p.membership_id=m.id ORDER BY m.created_at DESC`);res.json(r.rows);});
router.post("/memberships/:id/activate",async(req,res)=>{
 const {whatsapp_url="",signal_url="",expires_at=null}=req.body,client=await pool.connect();
 try{await client.query("BEGIN");const m=await client.query(`UPDATE memberships SET status='active',purchased_at=COALESCE(purchased_at,NOW()),expires_at=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[expires_at,req.params.id]);
 if(!m.rows.length){await client.query("ROLLBACK");return res.status(404).json({error:"Membership not found"});} const uid=m.rows[0].user_id;
 const c=await client.query(`INSERT INTO top_fan_cards(user_id,membership_id,card_number) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET membership_id=EXCLUDED.membership_id,active=TRUE RETURNING *`,[uid,m.rows[0].id,cardNumber()]);
 await client.query(`INSERT INTO show_benefits(membership_id,total_uses,used_count) VALUES($1,2,0) ON CONFLICT(membership_id) DO NOTHING`,[m.rows[0].id]);
 await client.query(`INSERT INTO private_channel_access(user_id,membership_id,whatsapp_url,signal_url,status,approved_at,approved_by) VALUES($1,$2,$3,$4,'approved',NOW(),$5) ON CONFLICT(user_id) DO UPDATE SET membership_id=EXCLUDED.membership_id,whatsapp_url=EXCLUDED.whatsapp_url,signal_url=EXCLUDED.signal_url,status='approved',approved_at=NOW(),approved_by=EXCLUDED.approved_by,updated_at=NOW()`,[uid,m.rows[0].id,whatsapp_url||null,signal_url||null,req.user.id]);
 await client.query("COMMIT");res.json({membership:m.rows[0],card:c.rows[0]});
 }catch(e){await client.query("ROLLBACK");res.status(500).json({error:"Activation failed"});}finally{client.release();}
});
router.get("/meet-greet",async(req,res)=>{const r=await pool.query(`SELECT r.*,u.name,u.email FROM meet_greet_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC`);res.json(r.rows);});
router.patch("/meet-greet/:id",async(req,res)=>{if(!["pending","approved","declined","completed","cancelled"].includes(req.body.status))return res.status(400).json({error:"Invalid status"});const r=await pool.query(`UPDATE meet_greet_requests SET status=$1,admin_notes=$2,updated_at=NOW() WHERE id=$3 RETURNING *`,[req.body.status,req.body.admin_notes||null,req.params.id]);if(!r.rows.length)return res.status(404).json({error:"Request not found"});res.json(r.rows[0]);});

router.get("/private-channel/:userId", async(req,res)=>{
  const r=await pool.query(`SELECT p.user_id,p.membership_id,p.status,p.approved_at,p.whatsapp_url,p.signal_url,u.name,u.email
    FROM private_channel_access p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`,[req.params.userId]);
  if(!r.rows.length)return res.status(404).json({error:"Access record not found"});
  res.json(r.rows[0]);
});

router.post("/private-channel/:userId/revoke",async(req,res)=>{const r=await pool.query(`UPDATE private_channel_access SET status='revoked',updated_at=NOW() WHERE user_id=$1 RETURNING *`,[req.params.userId]);if(!r.rows.length)return res.status(404).json({error:"Access record not found"});res.json(r.rows[0]);});
module.exports=router;
