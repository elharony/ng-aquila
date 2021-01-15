const { execSync } = require('child_process');
const cpx = require('cpx');
const { promisify } = require('util');
const rimraf = promisify(require('rimraf'));
const { opensourceThemes } = require('./themes.js');

/**
 * Script to build and copy all necessary files for the
 * library dist package that is outside of the Angular CLI Build
 * Includes:
 * + build schematics + copy the files
 * + build css
 * + copy scss sources
 */


function compileTheme(theme) {
    const result = execSync(`node-sass projects/ng-aquila/src/shared-styles/theming/prebuilt/` + theme + `.scss dist/ng-aquila/themes/` + theme + `.css`).toString();
    console.info(result);
}


function compileSchematics() {
  rimraf.sync('./dist/ng-aquila/schematics');

  execSync(`tsc -p ./projects/ng-aquila/tsconfig.schematics.json`, {stdio: 'inherit'});
  console.log('Copying schematic assets');
  cpx.copySync('./projects/ng-aquila/src/schematics/**/*.json', './dist/ng-aquila/schematics')
}

console.log("====================");
console.log("  Building themes");
opensourceThemes.forEach(theme => {
  compileTheme(theme);
});

console.log("========================");
console.log("  Building utility css");
['utilities', 'normalize'].forEach(file => {
    execSync(`node-sass projects/ng-aquila/src/shared-styles/${file}.scss -o dist/ng-aquila/css`, {stdio: 'inherit'});
})

console.log("========================");
console.log("  Building schematics");
// TODO enable again once schematics are fixed for Angular 11
console.log("  ... temporarily disabled");
// compileSchematics()

console.log("========================");
console.log("  Copying scss sources");
cpx.copy(`projects/ng-aquila/src/shared-styles/theming/**/*`, `dist/ng-aquila/styles`);

console.log("========================");
console.log("  Copying other assets");
cpx.copy('README.md', 'dist/ng-aquila');
cpx.copy('LICENSE', 'dist/ng-aquila');
