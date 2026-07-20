import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
export const offlinePacksRouter=Router();
offlinePacksRouter.get("/",requireAuth,async(req,res)=>{if(!supabaseAdmin)return res.json({success:true,data:[]});const{data,error}=await supabaseAdmin.from("offline_downloads").select("*").eq("user_id",req.user?.id).order("created_at",{ascending:false});if(error)throw error;res.json({success:true,data:data??[]})});
offlinePacksRouter.post("/",requireAuth,async(req,res)=>{const body=z.object({location_name:z.string().min(2),scope:z.enum(["city","district","province","state","country"]),estimated_size_mb:z.number().int().positive()}).parse(req.body);if(!supabaseAdmin)return res.status(201).json({success:true,data:{id:crypto.randomUUID(),user_id:req.user?.id,...body,status:"queued",progress:0}});const{data,error}=await supabaseAdmin.from("offline_downloads").insert({user_id:req.user?.id,...body,status:"queued",progress:0}).select("*").single();if(error)throw error;res.status(201).json({success:true,data})});
offlinePacksRouter.delete("/:id",requireAuth,async(req,res)=>{if(supabaseAdmin){const{error}=await supabaseAdmin.from("offline_downloads").delete().eq("id",req.params.id).eq("user_id",req.user?.id);if(error)throw error}res.status(204).send()});
