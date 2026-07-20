import { WifiOff } from "lucide-react";

export default function OfflineStatus(){

return(

<div className="rounded-3xl bg-gradient-to-r from-cyan-700 to-blue-700 p-8">

<div className="flex items-center gap-5">

<WifiOff size={40}/>

<div>

<h1 className="text-3xl font-bold">

Offline Maps Ready

</h1>

<p className="text-white/80 mt-2">

Download maps once and navigate without internet.

</p>

</div>

</div>

</div>

)

}