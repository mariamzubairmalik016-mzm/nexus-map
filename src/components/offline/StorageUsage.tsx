export default function StorageUsage(){

return(

<div className="grid md:grid-cols-4 gap-5 mt-10">

<div className="bg-slate-900 rounded-2xl p-6">

<p>Total Storage</p>

<h1 className="text-4xl font-bold mt-3">

128 GB

</h1>

</div>

<div className="bg-slate-900 rounded-2xl p-6">

<p>Used</p>

<h1 className="text-4xl font-bold mt-3">

16.8 GB

</h1>

</div>

<div className="bg-slate-900 rounded-2xl p-6">

<p>Downloaded Packs</p>

<h1 className="text-4xl font-bold mt-3">

14

</h1>

</div>

<div className="bg-slate-900 rounded-2xl p-6">

<p>Offline Trips</p>

<h1 className="text-4xl font-bold mt-3">

287

</h1>

</div>

</div>

)

}