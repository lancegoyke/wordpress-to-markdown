const turndown = require("turndown");
const turndownPluginGfm = require("turndown-plugin-gfm");

function initTurndownService() {
  const turndownService = new turndown({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  turndownService.use(turndownPluginGfm.tables);

  // preserve embedded tweets
  turndownService.addRule("tweet", {
    filter: (node) =>
      node.nodeName === "BLOCKQUOTE" &&
      node.getAttribute("class") === "twitter-tweet",
    replacement: (content, node) => "\n\n" + node.outerHTML,
  });

  // preserve embedded codepens
  turndownService.addRule("codepen", {
    filter: (node) => {
      // codepen embed snippets have changed over the years
      // but this series of checks should find the commonalities
      return (
        ["P", "DIV"].includes(node.nodeName) &&
        node.attributes["data-slug-hash"] &&
        node.getAttribute("class") === "codepen"
      );
    },
    replacement: (content, node) => "\n\n" + node.outerHTML,
  });

  // preserve embedded scripts (for tweets, codepens, gists, etc.)
  turndownService.addRule("script", {
    filter: "script",
    replacement: (content, node) => {
      let before = "\n\n";
      if (node.previousSibling && node.previousSibling.nodeName !== "#text") {
        // keep twitter and codepen <script> tags snug with the element above them
        before = "\n";
      }
      const html = node.outerHTML.replace('async=""', "async");
      return before + html + "\n\n";
    },
  });

  // preserve enlighter code blocks
  turndownService.addRule("enlighter", {
    filter: (node, options) => {
      return (
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.classList.contains("EnlighterJSRAW")
      );
    },
    replacement: (content, node) => {
      const language = node.getAttribute("data-enlighter-language") ?? "";
      const code = node.textContent;
      return "\n" + "```" + language + "\n" + code + "\n" + "```" + "\n";
    },
  });

  // preserve SyntaxHighlighter Evolved code blocks
  // this does not presever language information as it
  // is stored in the wp block comment and not in the HTML
  turndownService.addRule("syntaxhighlighter-evolved", {
    filter: (node, options) => {
      return (
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.classList.contains("wp-block-syntaxhighlighter-code")
      );
    },
    replacement: (content, node) => {
      const code = node.textContent;
      return "\n" + "```" + "\n" + code + "\n" + "```" + "\n";
    },
  });

  // preserve iframes (common for embedded audio/video)
  turndownService.addRule("iframe", {
    filter: "iframe",
    replacement: (content, node) => {
      const html = node.outerHTML.replace(
        'allowfullscreen=""',
        "allowfullscreen"
      );
      return "\n\n" + html + "\n\n";
    },
  });

  return turndownService;
}

function getPostContent(post, turndownService, config) {
  let content = post.encoded[0];

  // insert an empty div element between double line breaks
  // this nifty trick causes turndown to keep adjacent paragraphs separated
  // without mucking up content inside of other elemnts (like <code> blocks)
  content = content.replace(/(\r?\n){2}/g, "\n<div></div>\n");

  if (config.saveScrapedImages) {
    // writeImageFile() will save all content images to a relative /images
    // folder so update references in post content to match
    let assetsDir = "";
    if (config.postFolders) {
      // image is stored in a post folder (current directory)
      assetsDir = ".";
    } else {
      // store in assets directory
      assetsDir = "./" + config.assets;
    }
    content = content.replace(
      /(<img[^>]*src=").*?([^\/"]+\.(?:gif|jpe?g|png|svg|webp))(.*?)("[^>]*>)/gi,
      `$1${assetsDir}/images/$2$4`
    );
    content = content.replace(
      /(<a[^>]*href=").*?([^\/"]+\.(?:pdf))("[^>]*>)/gi,
      `$1${assetsDir}/$2$3`
    );
  }

  // this is a hack to make <iframe> nodes non-empty by inserting a "." which
  // allows the iframe rule declared in initTurndownService() to take effect
  // (using turndown's blankRule() and keep() solution did not work for me)
  content = content.replace(/(<\/iframe>)/gi, ".$1");

  // use turndown to convert HTML to Markdown
  content = turndownService.turndown(content);

  // clean up extra spaces in list items
  content = content.replace(/(-|\d+\.) +/g, "$1 ");

  // clean up the "." from the iframe hack above
  content = content.replace(/\.(<\/iframe>)/gi, "$1");

  return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
