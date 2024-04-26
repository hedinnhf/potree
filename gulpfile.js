
import { basename } from 'path';
import gulp, { task, series, src, dest, parallel } from 'gulp';

import { exec } from 'child_process';

import { promises, existsSync, mkdirSync, writeFileSync } from "fs";
const fsp = promises;
import concat from 'gulp-concat';
import { server as _server } from 'gulp-connect';
const { watch } = gulp;

import { createExamplesPage } from "./src/tools/create_potree_page.js";
import { createGithubPage } from "./src/tools/create_github_page.js";
import { createIconsPage } from "./src/tools/create_icons_page.js";


let paths = {
	laslaz: [
		"build/workers/laslaz-worker.js",
		"build/workers/lasdecoder-worker.js",
	],
	html: [
		"src/viewer/potree.css",
		"src/viewer/sidebar.html",
		"src/viewer/profile.html"
	],
	resources: [
		"resources/**/*"
	]
};

let workers = {
	"LASLAZWorker": [
		"libs/plasio/workers/laz-perf.js",
		"libs/plasio/workers/laz-loader-worker.js"
	],
	"LASDecoderWorker": [
		"src/workers/LASDecoderWorker.js"
	],
	"EptLaszipDecoderWorker": [
		"libs/copc/index.js",
		"src/workers/EptLaszipDecoderWorker.js",
	],
	"EptBinaryDecoderWorker": [
		"libs/ept/ParseBuffer.js",
		"src/workers/EptBinaryDecoderWorker.js"
	],
	"EptZstandardDecoderWorker": [
		"src/workers/EptZstandardDecoder_preamble.js",
		'libs/zstd-codec/bundle.js',
		"libs/ept/ParseBuffer.js",
		"src/workers/EptZstandardDecoderWorker.js"
	]
};

// these libs are lazily loaded
// in order for the lazy loader to find them, independent of the path of the html file,
// we package them together with potree
let lazyLibs = {
	"geopackage": "libs/geopackage",
	"sql.js": "libs/sql.js"
};

let shaders = [
	"src/materials/shaders/pointcloud.vs",
	"src/materials/shaders/pointcloud.fs",
	"src/materials/shaders/pointcloud_sm.vs",
	"src/materials/shaders/pointcloud_sm.fs",
	"src/materials/shaders/normalize.vs",
	"src/materials/shaders/normalize.fs",
	"src/materials/shaders/normalize_and_edl.fs",
	"src/materials/shaders/edl.vs",
	"src/materials/shaders/edl.fs",
	"src/materials/shaders/blur.vs",
	"src/materials/shaders/blur.fs",
];

// For development, it is now possible to use 'gulp webserver'
// from the command line to start the server (default port is 8080)
task('webserver', series(async function() {
	server = _server({
		port: 1234,
		https: false,
	});
}));

task('examples_page', async function(done) {
	await Promise.all([
		createExamplesPage(),
		createGithubPage(),
	]);

	done();
});

task('icons_viewer', async function(done) {
	createIconsPage();
	done();

});

task("workers", async function(done){

	for(let workerName of Object.keys(workers)){

		src(workers[workerName])
			.pipe(concat(`${workerName}.js`))
			.pipe(dest('build/potree/workers'));
	}

	src('./libs/copc/laz-perf.wasm')
		.pipe(dest('./build/potree/workers'));

	done();
});

task("lazylibs", async function(done){

	for(let libname of Object.keys(lazyLibs)){

		const libpath = lazyLibs[libname];

		src([`${libpath}/**/*`])
			.pipe(dest(`build/potree/lazylibs/${libname}`));
	}

	done();
});

task("shaders", async function(){

	const components = [
		"let Shaders = {};"
	];

	for(let file of shaders){
		const filename = basename(file);

		const content = await fsp.readFile(file);

		const prep = `Shaders["${filename}"] = \`${content}\``;

		components.push(prep);
	}

	components.push("export {Shaders};");

	const content = components.join("\n\n");

	const targetPath = `./build/shaders/shaders.js`;

	if(!existsSync("build/shaders")){
		mkdirSync("build/shaders");
	}
	writeFileSync(targetPath, content, {flag: "w"});
});

task('build', 
	series(
		parallel("workers", "lazylibs", "shaders", "icons_viewer", "examples_page"),
		async function(done){
			src(paths.html)
				.pipe(dest('build/potree/'));
			src(paths.resources, {removeBOM: false})
				.pipe(dest('build/potree/resources/'));
			src(["LICENSE"])
				.pipe(dest('build/potree/'));
			done();
		}
	)
);

task("pack", async function(){
	exec('rollup -c', function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);
	});
});

task('watch', parallel("build", "pack", "webserver", async function() {

	let watchlist = [
		'src/**/*.js',
		'src/**/**/*.js',
		'src/**/*.css',
		'src/**/*.html',
		'src/**/*.vs',
		'src/**/*.fs',
		'resources/**/*',
		'examples//**/*.json',
		'!resources/icons/index.html',
	];

	watch(watchlist, series("build", "pack"));

}));


