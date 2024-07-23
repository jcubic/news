const originalPostHandler = require('./original-post-handler');
const modifyHTMLContent = require('../modify-html-content');
const getImageDimensions = require('../../utils/get-image-dimensions');
const errorLogger = require('../../utils/error-logger');
const { siteURL } = require('../../config');
const stripDomain = require('../../utils/strip-domain');
const shortenExcerpt = require('../../utils/shorten-excerpt');

const removeUnusedKeys = obj => {
  const keysToRemove = [
    'uuid',
    'comment_id',
    'featured',
    'custom_excerpt',
    'custom_template',
    'canonical_url',
    'email_recipient_filter',
    'authors',
    'primary_tag',
    'access',
    'send_email_when_published',
    'og_image',
    'og_title',
    'og_description',
    'twitter_image',
    'twitter_title',
    'twitter_description',
    'meta_title',
    'meta_description',
    'email_subject',
    'accent_color'
  ];

  for (const key in obj) {
    if (keysToRemove.includes(key)) delete obj[key];
  }

  return obj;
};

const processBatch = async ({
  batch,
  contentType,
  currBatchNo,
  totalBatches
}) => {
  console.log(
    `Processing Ghost ${contentType} batch ${currBatchNo} of ${totalBatches}...and using ${process.memoryUsage.rss() / 1024 / 1024} MB of memory`
  );

  // Process current batch of posts / pages
  await Promise.all(
    batch.map(async obj => {
      // Clean incoming objects
      obj = removeUnusedKeys(obj);
      obj.primary_author = removeUnusedKeys(obj.primary_author);
      obj.tags.map(tag => removeUnusedKeys(tag));

      // Set the source of the publication and whether it's a page or post for tracking and later processing
      obj.source = 'Ghost';
      obj.contentType = contentType === 'posts' ? 'post' : 'page';

      // Set a default feature image for posts if one doesn't exist
      if (contentType === 'posts' && !obj.feature_image)
        obj.feature_image =
          'https://cdn.freecodecamp.org/platform/universal/fcc_meta_1920X1080-indigo.png';

      if (obj.feature_image) {
        // Feature image resolutions for structured data
        obj.image_dimensions = { ...obj.image_dimensions };
        obj.image_dimensions.feature_image = await getImageDimensions(
          obj.feature_image,
          obj.title
        );
      }

      // Author image resolutions for structured data
      if (obj.primary_author.profile_image) {
        obj.primary_author.image_dimensions = {
          ...obj.primary_author.image_dimensions
        };
        obj.primary_author.image_dimensions.profile_image =
          await getImageDimensions(
            obj.primary_author.profile_image,
            obj.primary_author.name,
            true
          );
      }

      if (obj.primary_author.cover_image) {
        obj.primary_author.image_dimensions = {
          ...obj.primary_author.image_dimensions
        };
        obj.primary_author.image_dimensions.cover_image =
          await getImageDimensions(
            obj.primary_author.cover_image,
            obj.primary_author.name,
            true
          );
      }

      // Tag image resolutions for structured data
      await Promise.all(
        obj.tags.map(async tag => {
          if (tag.feature_image) {
            tag.image_dimensions = { ...tag.image_dimensions };
            tag.image_dimensions.feature_image = await getImageDimensions(
              tag.feature_image,
              tag.name,
              true
            );
          }
        })
      );

      // General cleanup and prep -- attach path to post / page
      // objects, convert dates, and fix pages that should exist
      obj.path = stripDomain(obj.url);
      obj.primary_author.path = stripDomain(obj.primary_author.url);
      obj.tags.forEach(tag => {
        // Log and fix tag pages that point to 404 due to a Ghost error
        if (tag.url.endsWith('/404/') && tag.visibility === 'public') {
          errorLogger({ type: 'tag', name: tag.name });
          tag.url = `${siteURL}/tag/${tag.slug}/`;
        }

        tag.path = stripDomain(tag.url);
      });

      // Log and fix author pages that point to 404 due to a Ghost error
      if (obj.primary_author.url.endsWith('/404/')) {
        errorLogger({ type: 'author', name: obj.primary_author.name });
        obj.primary_author.url = `${siteURL}/author/${obj.primary_author.slug}/`;
      }

      obj.primary_author.path = stripDomain(obj.primary_author.url);

      // Convert publish date into a Date object
      obj.published_at = new Date(obj.published_at);

      // Original author / translator feature
      if (obj.codeinjection_head || obj.codeinjection_foot)
        obj = await originalPostHandler(obj);

      // Stash original excerpt and escape for structured data.
      // Shorten the default excerpt and replace newlines -- the
      // browser will normalize multiple spaces
      if (obj.excerpt) {
        obj.original_excerpt = obj.excerpt;

        obj.excerpt = shortenExcerpt(obj.excerpt);
      }

      // Enable lazy loading of images and embedded videos, set width, height, and add a default
      // alt attribute to images if one doesn't exist.
      // Also, append Google ads to post body and generate bottom banner ad if ads are enabled.
      obj.html = await modifyHTMLContent({
        postContent: obj.html,
        postTitle: obj.title,
        source: obj.source
      });

      return obj;
    })
  );

  return batch;
};

module.exports = processBatch;
