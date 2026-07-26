import React from "react";

type Region = {
	id: number;
	name: string;
	size: string;
	country: string;
	downloaded: boolean;
};

// Local fallback DownloadCard to avoid unresolved import during build.
function DownloadCard({ region }: { region: Region }) {
	return (
		<div className="p-4 border rounded-md">
			<h2 className="font-semibold">{region.name}</h2>
			<p className="text-sm text-slate-500">{region.country} • {region.size}</p>
			<p className="mt-2 text-xs">{region.downloaded ? 'Downloaded' : 'Not downloaded'}</p>
		</div>
	);
}

const regions = [

{
id:1,
name:"Pakistan",
size:"2.4 GB",
country:"Pakistan",
downloaded:true
},

{
id:2,
name:"Saudi Arabia",
size:"1.8 GB",
country:"Saudi Arabia",
downloaded:false
},

{
id:3,
name:"United Arab Emirates",
size:"1.2 GB",
country:"UAE",
downloaded:false
},

{
id:4,
name:"Turkey",
size:"2.6 GB",
country:"Turkey",
downloaded:false
},

{
id:5,
name:"United Kingdom",
size:"4.4 GB",
country:"UK",
downloaded:false
},

{
id:6,
name:"United States",
size:"12.7 GB",
country:"USA",
downloaded:false
}

];

export default function DownloadManager(){

return(

<>

<h1 className="text-4xl font-bold mt-12">

Offline Download Manager

</h1>

<p className="text-slate-400 mt-3">

Download complete countries for offline navigation.

</p>

<div className="grid lg:grid-cols-3 gap-8 mt-10">

{

regions.map(region=>(

<DownloadCard

key={region.id}

region={region}

/>

))

}

</div>

</>

)

}