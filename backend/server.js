require("dotenv").config();const path=require("path"),express=require("express"),cors=require("cors"),helmet=require("helmet"),cookieParser=require("cookie-parser"),rateLimit=require("express-rate-limit"),{Pool}=require("pg");
const fs=require("fs");
const app=express(),pool=new Pool({connectionString:process.env.DATABASE_URL});
async function initializeDatabase(){
  const sql=fs.readFileSync(path.join(__dirname,"..","database","schema.sql"),"utf8");
  await pool.query(sql);
  if(process.env.ADMIN_BOOTSTRAP_EMAIL){
    await pool.query("UPDATE users SET role='admin' WHERE lower(email)=lower($1)",[process.env.ADMIN_BOOTSTRAP_EMAIL]);
  }
}

app.set("trust proxy",1);app.use(helmet({contentSecurityPolicy:false}));app.use(cors({origin:process.env.FRONTEND_ORIGIN||true,credentials:true}));app.use(cookieParser());app.use(express.json({limit:"1mb"}));
app.use("/api/auth",rateLimit({windowMs:15*60*1000,max:40}),require("./routes/auth")(pool));
app.use("/api/users",require("./routes/users")(pool));app.use("/api/posts",require("./routes/posts")(pool));app.use("/api/reports",require("./routes/reports")(pool));app.use("/api/notifications",require("./routes/notifications")(pool));app.use("/api/admin",require("./routes/admin")(pool));
app.use(express.static(path.join(__dirname,"..","frontend")));app.get("/api/health",(q,s)=>s.json({ok:true}));app.get("*",(q,s)=>s.sendFile(path.join(__dirname,"..","frontend","index.html")));

const {router:membershipRouter,pool:membershipPool}=require("./routes/membership");
const adminMembershipRouter=require("./routes/admin_membership");
app.use("/api/membership",membershipRouter);
app.use("/api/admin/membership",adminMembershipRouter);
app.post("/api/payments/stripe/webhook",express.raw({type:"application/json"}),async(req,res)=>{
 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).send("Stripe webhook not configured");
 try{const Stripe=require("stripe"),stripe=Stripe(process.env.STRIPE_SECRET_KEY);
 const event=stripe.webhooks.constructEvent(req.body,req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET);
 if(event.type==="checkout.session.completed"){const session=event.data.object,mid=session.metadata?.membership_id;
  if(mid){const client=await membershipPool.connect();try{await client.query("BEGIN");const m=await client.query(`UPDATE memberships SET status='active',purchased_at=COALESCE(purchased_at,NOW()),updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING *`,[mid]);
   if(m.rows.length){const uid=m.rows[0].user_id,card="JC-TF-"+require("crypto").randomBytes(5).toString("hex").toUpperCase();await client.query(`INSERT INTO top_fan_cards(user_id,membership_id,card_number) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET membership_id=EXCLUDED.membership_id,active=TRUE`,[uid,mid,card]);await client.query(`INSERT INTO show_benefits(membership_id,total_uses,used_count) VALUES($1,2,0) ON CONFLICT(membership_id) DO NOTHING`,[mid]);}
   await client.query(`INSERT INTO payment_events(provider,event_id,event_type,payload) VALUES('stripe',$1,$2,$3) ON CONFLICT(event_id) DO NOTHING`,[event.id,event.type,event]);await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}}
 }res.json({received:true});}catch(e){res.status(400).send("Webhook Error: "+e.message)}
});

const PORT=process.env.PORT||3000;
initializeDatabase()
  .then(()=>app.listen(PORT,()=>console.log(`JC Fanbase running on ${PORT}`)))
  .catch(err=>{console.error("Database initialization failed:",err);process.exit(1);});