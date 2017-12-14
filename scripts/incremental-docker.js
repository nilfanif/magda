const childProcess = require('child_process');
const fse = require('fs-extra');
const getAllPackages = require('./getAllPackages');
const lastModifiedFile = require('./lastModifiedFile');
const moment = require('moment');
const path = require('path');

const packagePaths = getAllPackages();

const failed = [];
const succeeded = [];

packagePaths.forEach(packagePath => {
    const packageJson = require(path.resolve(packagePath, 'package.json'));
    if (!packageJson || !packageJson.scripts || !packageJson.scripts['docker-build-local']) {
        return;
    }

    // If this is an SBT project, supplement the package.json with some info from build.sbt.
    const buildSbtPath = path.resolve(packagePath, 'build.sbt');
    if (fse.existsSync(buildSbtPath)) {
        const buildSbt = fse.readFileSync(buildSbtPath, 'utf8');
        const sbtImageName = /name := "(.*)"/.exec(buildSbt)[1];
        if (!sbtImageName || sbtImageName.length === 0) {
            return;
        }

        packageJson.config = packageJson.config || {};
        packageJson.config.docker = {
            name: 'data61/' + sbtImageName,
            // TODO: we hard-code a dependency on magda-scala-common because determining the
            //       actual dependencies from the root build.sbt is... as hassle.
            include: 'src generated ../magda-scala-common/src'
        };
    }

    const name = packageJson.name;
    if (!packageJson.config || !packageJson.config.docker || !packageJson.config.docker.name) {
        return;
    }

    const imageName = packageJson.config.docker.name;

    const imageUpdateDateProcess = childProcess.spawnSync('docker', [
        'images', `localhost:5000/${imageName}:latest`,
        '--format', '{{.CreatedAt}}'
    ], {
        stdio: ['inherit', 'pipe', 'inherit'],
        encoding: 'utf8'
    });

    // if (imageUpdateDateProcess.status !== 0) {
    //     console.log('Docker returned an error. Do you need to run "eval $(minikube docker-env)"?');
    //     process.exit(1);
    // }

    const dateString = imageUpdateDateProcess.stdout.trim();

    let needsBuild = dateString.length === 0;
    if (needsBuild) {
        console.log(`${name}: docker image does not yet exist`)
    } else {
        const imageDate = moment.utc(dateString, 'YYYY-MM-DD HH:mm:ss ZZ');

        const includedPaths = packageJson.config.docker.include.split(' ').filter(p => p !== 'node_modules');
        const lastModifiedDates = includedPaths.map(p => lastModifiedFile(path.resolve(packagePath, p))).filter(f => f && f.stats && f.stats.mtime).map(f => moment.utc(f.stats.mtime));
        const lastLastModifiedDate = lastModifiedDates.reduce((previous, current) => current > previous ? current : previous, moment.utc(0));

        if (lastLastModifiedDate > imageDate) {
            console.log(`${name}: docker image is outdated`);
            needsBuild = true;
        } else {
            console.log(`${name}: docker image is up-to-date`);
        }
    }

    if (needsBuild) {
        const result = childProcess.spawnSync(
            "npm", [ "run", "docker-build-local" ],
            {
                stdio: ["inherit", "inherit", "inherit"],
                shell: true,
                cwd: packagePath
            }
        );

        if (result.status > 0) {
            failed.push(packagePath);
            console.log(`${name}: BUILD FAILED`);
        } else {
            succeeded.push(packagePath);
        }
    }
});

if (succeeded.length > 0) {
    console.log();
    console.log('The following packages were built successfully:');
    succeeded.map(s => '  ' + s).forEach(s => console.log(s));
}

if (failed.length > 0) {
    console.log();
    console.log('The following package builds FAILED:');
    failed.map(s => '  ' + s).forEach(s => console.log(s));
}