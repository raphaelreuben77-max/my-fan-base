
const express=require("express"); const crypto=require("crypto"); const {Pool}=require("pg"); const auth=require("../middleware/auth");
const router=express.Router(); const pool=new Pool({connectionString:process.env.DATABASE_URL});
const priceCents=Math.round(Number(process.env.MEMBERSHIP_PRICE_USD||550)*100);
function cardNumber(){return "JC-TF-"+crypto.randomBytes(5).toString("hex").toUpperCase();}
router.get("/me",auth,async(req,res)=>{
 const q=await pool.query(`SELECT m.*,c.card_number,b.total_uses,b.used_count,p.status AS channel_status,p.whatsapp_url,p.signal_url
 FROM memberships m LEFT JOIN top_fan_cards c ON c.membership_id=m.id LEFT JOIN show_benefits b ON b.membership_id=m.id
 LEFT JOIN private_channel_access p ON p.membership_id=m.id WHERE m.user_id=$1 ORDER BY m.created_at DESC LIMIT 1`,[req.user.id]);
 res.json(q.rows[0]||null);
});
router.post("/checkout",auth,async(req,res)=>{
 if(!process.env.STRIPE_SECRET_KEY)return res.status(503).json({error:"Online payment is not configured yet."});
 const Stripe=require("stripe"),stripe=Stripe(process.env.STRIPE_SECRET_KEY);
 const active=await pool.query(`SELECT id FROM memberships WHERE user_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[req.user.id]);
 if(active.rows.length)return res.status(409).json({error:"You already have an active membership."});
 const m=await pool.query(`INSERT INTO memberships(user_id,amount_cents,currency,status,provider) VALUES($1,$2,'USD','pending','stripe') RETURNING id`,[req.user.id,priceCents]);
 const s=await stripe.checkout.sessions.create({mode:"payment",customer_email:req.user.email,line_items:[{price_data:{currency:"usd",product_data:{name:"Jerry Cantrell Fanbase Membership"},unit_amount:priceCents},quantity:1}],metadata:{membership_id:m.rows[0].id,user_id:req.user.id},success_url:process.env.STRIPE_SUCCESS_URL,cancel_url:process.env.STRIPE_CANCEL_URL});
 await pool.query(`UPDATE memberships SET provider_reference=$1 WHERE id=$2`,[s.id,m.rows[0].id]); res.json({url:s.url});
});
router.post("/meet-greet",auth,async(req,res)=>{
 const m=await pool.query(`SELECT id FROM memberships WHERE user_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY created_at DESC LIMIT 1`,[req.user.id]);
 if(!m.rows.length)return res.status(403).json({error:"An active membership is required."});
 const {requested_show,requested_city,requested_date,message}=req.body;
 const r=await pool.query(`INSERT INTO meet_greet_requests(user_id,membership_id,requested_show,requested_city,requested_date,message) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,m.rows[0].id,requested_show||null,requested_city||null,requested_date||null,message||null]);
 res.status(201).json(r.rows[0]);
});
router.get("/meet-greet",auth,async(req,res)=>{const r=await pool.query(`SELECT * FROM meet_greet_requests WHERE user_id=$1 ORDER BY created_at DESC`,[req.user.id]);res.json(r.rows);});
module.exports={router,pool,priceCents,cardNumber};
