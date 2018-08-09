/**
 * ITRI Newsletter generator
 */

'use strict';

const Converter = require('csvtojson').Converter;
const Handlebars = require('handlebars');
const _ = require('underscore');
const async = require('async');
const branch = require('node-branch-io');
const fs = require('fs');
const inlineCSS = require('inline-css');
const request = require('request');
const shortid = require('shortid');

const CONFERENCE_INFO_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ZOOfe8vel4jg199WGvLPlwE8Nk444LjYw7Qwig_Cjo0/export?format=csv&gid=1333595318';
const GENERAL_INFO_SHEET_URL = 'https://docs.google.com/spreadsheets/u/0/d/1ZOOfe8vel4jg199WGvLPlwE8Nk444LjYw7Qwig_Cjo0/export?format=csv&gid=0';
const INDUSTRY_INFO_SHEET_URL = 'https://docs.google.com/spreadsheets/u/0/d/1ZOOfe8vel4jg199WGvLPlwE8Nk444LjYw7Qwig_Cjo0/export?format=csv&gid=447109349';
const TECHNOLOGY_CATEGORIES_URL = 'https://docs.google.com/spreadsheets/d/1ZOOfe8vel4jg199WGvLPlwE8Nk444LjYw7Qwig_Cjo0/export?format=csv&gid=1200408266';
const TECHNOLOGY_INFO_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ZOOfe8vel4jg199WGvLPlwE8Nk444LjYw7Qwig_Cjo0/export?format=csv&gid=1932562813';

const TEMPLATE_FILE = __dirname + '/template.htm';

function convertJSON(url, cb) {
  const converter = new Converter({});
  converter.on('end_parsed', data => cb(null, data));
  request.get(url).pipe(converter);
}

function generateID(item) {
  item.id = shortid.generate();
  return item;
}

function highlightFilter(item) {
  return !!item.highlighted;
}

/**
 * Generate Branch URLs and replace with these URLs
 */
function generateBranchURLs(ver, results, done) {
  if (!ver) {
    return done(null, []);
  }
  const key = ver === 'release'
    ? process.env.BRANCH_KEY
    : process.env.BRANCH_TEST_KEY;
  const general = results.general[0];
  const items = [].concat(
    results.conference,
    results.industry,
    results.technology
  );
  let branchData = [{ // This is the pixel for Itri Newsletter website
    campaign: 'Itri Newsletter',
    channel: 'Email',
    tags: ['itri', general.date],
    data: {
      '$marketing_title': general.title,
      '$desktop_url': general.url,
      '$ios_url': general.url,
      '$android_url': general.url
    }
  }].concat(
    items.map(item => ({
      campaign: 'Itri Newsletter',
      channel: 'Email',
      tags: ['itri', general.date],
      data: {
        '$marketing_title': item.title,
        '$desktop_url': item.url,
        '$ios_url': item.url,
        '$android_url': item.url
      }
    }))
  );
  branch.link.createMany(key, branchData).then((data) => {
    general.pixel = data.shift().url;
    data.forEach((d, i) => {
      items[i].url = d.url;
    });
    done(null, data);
  });
}

function processData(results) {
  const general = results.general[0];
  const techCategories = results.techCategories.map(item => item.value);
  let conference = results.conference.map(generateID);
  let industry = results.industry.map(generateID);
  let technology = results.technology.map(generateID);
  // highlight are only from industry, technology
  let highlight = [].concat(technology, industry).filter(highlightFilter);

  conference = _.groupBy(_.sortBy(results.conference, item => Date.parse(item.start_date)), 'category');
  industry = _.sortBy(results.industry, item => Date.parse(item.date));
  technology = _.groupBy(_.sortBy(results.technology, item => Date.parse(item.date)), 'category');

  return {
    conference,
    general,
    highlight,
    industry,
    techCategories,
    technology
  };
}

function generateNewsletter(ver, done) {

  let templateHTML = fs.readFileSync(TEMPLATE_FILE).toString();
  //inlineCSS(templateHTML, {url: '.'}).then(html => { templateHTML = html; });

  Handlebars.registerHelper(
    'withItem',
    (object, options) => options.fn(object[options.hash.key])
  );

  async.auto({
    conference: convertJSON.bind(null, CONFERENCE_INFO_SHEET_URL),
    general: convertJSON.bind(null, GENERAL_INFO_SHEET_URL),
    industry: convertJSON.bind(null, INDUSTRY_INFO_SHEET_URL),
    techCategories: convertJSON.bind(null, TECHNOLOGY_CATEGORIES_URL),
    technology: convertJSON.bind(null, TECHNOLOGY_INFO_SHEET_URL),
    branchURLs: [
      'conference',
      'general',
      'industry',
      'technology',
      generateBranchURLs.bind(null, ver)
    ]
  }, function (err, results) {
    if (err || !results) {
      return;
    }
    results = processData(results);
    const template = Handlebars.compile(templateHTML);
    const output = template(results);
    done && done(output);
  });
}

module.exports = generateNewsletter;
