const repo_version = typeof(REPO_VERSION) != "undefined" ? REPO_VERSION :
  "@gh-pages"
// Admin user password.
const password_value_admin = typeof(PASSWORD_ADMIN) != "undefined" ? PASSWORD_ADMIN :
  "admin"
// Guest user password.
const password_value = typeof(PASSWORD) != "undefined" ? PASSWORD :
  ""
// Redirect the homepage if it defined.
const index_redirect = typeof(INDEX_REDIRECT) != "undefined" ? INDEX_REDIRECT :
  ""
// The URL of the deployed website.
const url_exclude = typeof(URL_EXCLUDE) != "undefined" ? URL_EXCLUDE :
  "//url-shortener-demo.jhw.li"
// Homepage path for admin user, use the empty value for default theme.
const theme_admin = typeof(THEME_ADMIN) != "undefined" ? THEME_ADMIN :
  ""
// Homepage path for guest user, use the empty value for default theme.
const theme = typeof(THEME) != "undefined" ? THEME :
  ""
const len = typeof(LEN) != "undefined" ? parseInt(LEN) :
  6
// Control the HTTP referrer header, if you want to create an anonymous link that will hide the HTTP Referer header, please set to "true" .
const no_ref = typeof(NO_REF) != "undefined" ? NO_REF :
  "false"
// Allow Cross-origin resource sharing for API requests.
const cors = typeof(CORS) != "undefined" ? CORS :
  "false"
// For all users. If it is true, the same long url will be shorten into the same short url.
const unique_link = typeof(UNIQUE_LINK) != "undefined" ? UNIQUE_LINK :
  "false"
// For guest user only. Allow users to customize the short url.
const custom_link = typeof(CUSTOM_LINK) != "undefined" ? CUSTOM_LINK :
  "true"
// For guest user only.
const len_limit = typeof(LEN_LIMIT) != "undefined" ? parseInt(LEN_LIMIT) :
  3
// Enable the regular expression redirec.
// The regular expression is configured in json format in #regexRedirect key in KV.
// Regex matching has higher priority than path-value matching.
const regex_redirect = typeof(REGEX_REDIRECT) != "undefined" ? REGEX_REDIRECT :
  "false"
const regex_key = "#regexRedirect";

const html404 = `<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>`

let response_header = {
  "content-type": "text/html;charset=UTF-8",
}

if (cors == "true") {
  response_header = {
    "content-type": "text/html;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
  }
}

async function randomString(len) {
  len = len || 6;
  let $chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"; /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  let maxPos = $chars.length;
  let result = "";
  for (i = 0; i < len; i++) {
    result += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

async function sha512(url) {
  url = new TextEncoder().encode(url)

  const url_digest = await crypto.subtle.digest({
      name: "SHA-512",
    },
    url, // The data you want to hash as an ArrayBuffer
  )
  const hashArray = Array.from(new Uint8Array(url_digest)); // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  // console.log(hashHex)
  return hashHex
}
async function checkURL(URL) {
  let str = URL;
  let Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  let objExp = new RegExp(Expression);
  if (objExp.test(str) == true) {
    if (str[0] == "h")
      return true;
    else
      return false;
  } else {
    return false;
  }
}
async function save_url(URL) {
  let random_key = await randomString()
  let is_exist = await LINKS.get(random_key)
  console.log(is_exist)
  if (is_exist == null)
    return await LINKS.put(random_key, URL), random_key
  else
    save_url(URL)
}
async function is_url_exist(url_sha512) {
  let is_exist = await LINKS.get(url_sha512)
  console.log(is_exist)
  if (is_exist == null) {
    return false
  } else {
    return is_exist
  }
}
async function handleRequest(request) {
  console.log(request)

  if (request.method === "POST") {
    let req = await request.json()

    let req_password = req["password"]
    let user
    if (password_value_admin && req_password === password_value_admin) {
      user = 10; // Admin user
    } else if (!password_value || req_password === password_value) {
      user = 1; // Guest user
    } else {
      user = 0; // Unauthorized user
    }

    let req_cmd = req["cmd"]
    if (req_cmd == "add") {
      let req_url = req["url"]
      let req_keyPhrase = req["keyPhrase"]
      let req_keyPhLen = req_keyPhrase.length

      // console.log("req_url:"+req_url)
      // console.log("req_keyPhrase:"+req_keyPhrase)
      // console.log("req_password:"+req_password)
      // console.log("user:"+user)

      if (user === 0) {
        // Incorrect password.
        return new Response(`{"status":500,"key": "", "error":"Error: Invalid password."}`, {
          headers: response_header,
        })
      }
      if (user === 1) {
        if (!await checkURL(req_url)) {
          return new Response(`{"status":500,"key": "", "error":"Error: URL illegal."}`, {
            headers: response_header,
          })
        }
        if (req_url.indexOf(url_exclude) != -1) {
          return new Response(`{"status":500,"key": "", "error":"Error: URL illegal."}`, {
            headers: response_header,
          })
        }
        // req_keyPhrase containing symbol.
        if (req_keyPhrase && !/^[a-zA-Z0-9]+$/.test(req_keyPhrase)) {
          return new Response(`{"status":500,"key": "", "error":"Error: Custom short URL illegal."}`, {
            headers: response_header,
          })
        }
        if (req_keyPhLen < len_limit && req_keyPhLen > 0) {
          return new Response(`{"status":500,"key": "", "error":"Error: Custom short URL is too short."}`, {
            headers: response_header,
          })
        }
      }

      // Custom short URL existed.
      let stat, random_key
      if (custom_link == "true" && (req_keyPhrase != "")) {
        let is_exist = await LINKS.get(req_keyPhrase)
        if (is_exist != null && user <= 1) {
          return new Response(`{"status":500,"key": "", "error":"Error: Custom short URL is not available."}`, {
            headers: response_header,
          })
        } else {
          random_key = req_keyPhrase
          stat, await LINKS.put(req_keyPhrase, req_url)
        }
      } else if (unique_link == "true") {
        let url_sha512 = await sha512(req_url)
        let url_key = await is_url_exist(url_sha512)
        if (url_key) {
          random_key = url_key
        } else {
          stat,
          random_key = await save_url(req_url);
          if (typeof(stat) == "undefined") {
            // console.log(await LINKS.put(url_sha512,random_key))
          }
        }
      } else {
        stat,
        random_key = await save_url(req_url);
      }
      // console.log(stat)
      if (typeof(stat) == "undefined") {
        return new Response(`{"status":200, "key":"` + random_key + `", "error": ""}`, {
          headers: response_header,
        })
      } else {
        return new Response(`{"status":500, "key": "", "error":"Error: Reach the KV write limitation."}`, {
          headers: response_header,
        })
      }

      // Delete a single KV record.
    } else if (req_cmd == "del") {
      let req_keyPhrase = req["keyPhrase"]

      if (user == 0) {
        return new Response(`{"status":500,"key": "", "error":"Error: Invalid password."}`, {
          headers: response_header,
        })
      }

      await LINKS.delete(req_keyPhrase)
      return new Response(`{"status":200}`, {
        headers: response_header,
      })

      // Load all KV records.
    } else if (req_cmd == "qryall") {
      if (user !== 10) {
        return new Response(`{"status":500, "error":"Error: Invalid password."}`, {
          headers: response_header,
        })
      }
      let keyList = await LINKS.list()
      if (keyList != null) {
        // 初始化返回数据结构 Init the return struct
        let jsonObjectRetrun = JSON.parse(`{"status":200, "error":"", "kvlist": []}`);

        for (var i = 0; i < keyList.keys.length; i++) {
          let item = keyList.keys[i];

          let url = await LINKS.get(item.name);

          let newElement = {
            "key": item.name,
            "value": url
          };
          // 填充要返回的列表 Fill the return list
          jsonObjectRetrun.kvlist.push(newElement);
        }

        return new Response(JSON.stringify(jsonObjectRetrun), {
          headers: response_header,
        })
      } else {
        return new Response(`{"status":500, "error":"Error: Download records failed."}`, {
          headers: response_header,
        })
      }
    }

  } else if (request.method === "OPTIONS") {
    return new Response(``, {
      headers: response_header,
    })
  }

  const requestURL = new URL(request.url)
  const path = requestURL.pathname.split("/")[1]
  const params = requestURL.search;

  console.log(path)
  // Redirect the homepage.
  if (!path && index_redirect) {
    return Response.redirect(index_redirect, 302)
  }

  // Admin user homepage.
  if (password_value_admin && path == password_value_admin) {
    let index = await fetch("https://fastly.jsdelivr.net/gh/Monopink/Url-Shorten-Worker" + repo_version + "/" + theme_admin + "/index.html")
    index = await index.text()
    index = index.replaceAll(/__REPO_VERSION__/gm, repo_version)
    index = index.replaceAll(/__PASSWORD__/gm, path)
    return new Response(index, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    })
  }

  // Guest user homepage.
  if ((!path && !password_value) || path == password_value) {
    let index = await fetch("https://fastly.jsdelivr.net/gh/Monopink/Url-Shorten-Worker" + repo_version + "/" + theme + "/index.html")
    index = await index.text()
    index = index.replaceAll(/__REPO_VERSION__/gm, repo_version)
    index = index.replaceAll(/__PASSWORD__/gm, path)
    return new Response(index, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    })
  } else if (!path) {
    return new Response(html404, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
      status: 404
    })
  }

  let location;

  if (regex_redirect == "true") {
    try {
      const regexJson = await LINKS.get(regex_key);
      const regexDict = JSON.parse(regexJson);

      for (const pattern in regexDict) {
        const regex = new RegExp(pattern);
        if (regex.test(path)) {
          location = path.replace(regex, regexDict[pattern]);
          continue;
        }

      }
    } catch(err){
      console.log(err);
    }
  }

  // Not hit by regex.
  if (!location) {
    const value = await LINKS.get(path);
    location = params ? value + params : value;
  }

  // console.log(value)

  if (location) {
    // Check if it's a valid URL
    let isValidUrl = false;
    try {
      new URL(location);
      isValidUrl = true;
    } catch (e) {
      isValidUrl = false;
    }
  
    if (isValidUrl) {
      // URL redirect
      if (no_ref == "true") {
        let no_ref = await fetch("https://Monopink.github.io/Url-Shorten-Worker/no-ref.html")
        no_ref = await no_ref.text()
        no_ref = no_ref.replace(/{Replace}/gm, location)
        return new Response(no_ref, {
          headers: {
            "content-type": "text/html;charset=UTF-8",
          },
        })
      } else {
        return Response.redirect(location, 302)
      }
    } else {
      // Not a valid URL, return the content directly
      return new Response(location, {
        headers: {
          "content-type": "text/plain;charset=UTF-8",
        },
      })
    }
  }
  // If request not in kv, return 404
  return new Response(html404, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
    status: 404
  })
}

addEventListener("fetch", async event => {
  event.respondWith(handleRequest(event.request))
})
