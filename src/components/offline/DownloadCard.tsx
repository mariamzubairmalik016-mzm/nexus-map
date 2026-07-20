import { Download } from "lucide-react";

export default function DownloadCard({region}:any){

return(

<div className="rounded-3xl bg-slate-900 border border-cyan-500/20 p-6">

<h2 className="text-2xl font-bold">

{region.name}

</h2>

<p className="text-slate-400 mt-2">

Size : {region.size}

</p>

<div className="mt-8">

{

region.downloaded?

<button

className="bg-green-600 w-full rounded-xl py-3"

>

Downloaded

</button>

:

<button

className="bg-cyan-600 hover:bg-cyan-500 w-full rounded-xl py-3 flex justify-center gap-3"

>

<Download size={20}/>

Download Offline Pack

</button>

}

</div>

</div>

)

}