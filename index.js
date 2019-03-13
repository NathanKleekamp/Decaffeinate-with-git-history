#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const git = require('simple-git/promise');

const execPromise = promisify(exec);
const fileToDecaffeinate = process.argv[2];
const newFileName = getNewFileName();

function getNewFileName() {
  const parsedPath = path.parse(fileToDecaffeinate);
  const splitFileName = parsedPath.base.split('.');
  const coffeeIndex = splitFileName.indexOf('coffee');

  // Bitwise coerce -1 to falsy '0' or to truthy value
  if (~coffeeIndex) {
    splitFileName.splice(coffeeIndex, coffeeIndex, 'js');
  }

  parsedPath.base = splitFileName.join('.');

  return path.format(parsedPath);
}

async function makeBackupFile() {
  try {
    await fs.copy(fileToDecaffeinate, `${fileToDecaffeinate}.bak`);
  } catch(error) {
    console.error('Error creating backup file', error);
  }
}

async function rmBackupFile() {
  try {
    await fs.remove(`${fileToDecaffeinate}.bak`);
  } catch(error) {
    console.error('Error deleting backup file', error);
  }
}

async function restoreBackupFile() {
  try {
    console.log('Restoring backup file');
    await fs.move(`${fileToDecaffeinate}.bak`, fileToDecaffeinate);
  } catch(error) {
    console.error('There was an error restoring the backup', error);
  }
}

async function gitStatus() {
  let summary;

  try {
    summary = await git().status();
  } catch(error) {
    console.log('Git status error: ', error);
  }

  return summary;
}

async function gitAddAll() {
  let added;

  try {
    added = await git().add('./*');
  } catch(error) {
    console.log('Git add error: ', error);
  }

  return added;
}

async function gitCommit() {
  const message = `renaming ${path.basename(fileToDecaffeinate)} to ${path.basename(newFileName)}`;

  try {
    await gitAddAll();
    const status = await gitStatus();
    console.log('Git status: ', status);
    await git().commit(message, { '--no-verify': true });
  } catch(error) {
    console.log('Git commit error: ', error);
  }
}

async function rename(former, current) {
  try {
    await fs.move(former, current);
  } catch(error) {
    console.error('Error renaming file', error);
    restoreBackupFile();
  }
}

async function decaffeinate(f1le) {
  try {
    execPromise(`decaffeinate --loose-js-modules ${f1le}`);
  } catch(error) {
    console.error('Error while decaffeinating: ', error);
  }
}

async function main() {
  try {
    await makeBackupFile();
    await rename(fileToDecaffeinate, newFileName);
    await rmBackupFile();
    await gitCommit();
    await rename(newFileName, fileToDecaffeinate);
    await decaffeinate(fileToDecaffeinate);
  } catch(error) {
    console.error(error);
  }
}

main();
