const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'public', 'textures');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const files = {
    'earth-color.jpg': 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg',
    'earth-bump.png': 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-topology.png',
    'earth-water.png': 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-water.png',
    'earth-clouds.png': 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-clouds.png'
};

const download = (filename, url) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path.join(dir, filename));
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return download(filename, response.headers.location).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(path.join(dir, filename), () => {});
            reject(err);
        });
    });
};

Promise.all(Object.entries(files).map(([filename, url]) => download(filename, url)))
    .then(() => console.log('Successfully downloaded all textures.'))
    .catch(err => console.error('Error downloading textures:', err));
