import json
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.request
import re
import os

class RequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Keep logs clean
        pass

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # Route static files
        if path == "/" or path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open("index.html", "rb") as f:
                self.wfile.write(f.read())
        elif path == "/index.css":
            self.send_response(200)
            self.send_header("Content-Type", "text/css")
            self.end_headers()
            with open("index.css", "rb") as f:
                self.wfile.write(f.read())
        elif path == "/index.js":
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.end_headers()
            with open("index.js", "rb") as f:
                self.wfile.write(f.read())
        elif path == "/api/stream":
            query = urllib.parse.parse_qs(parsed_url.query)
            target_url = query.get("url", [None])[0]
            if target_url:
                self.send_response(302)
                self.send_header("Location", target_url)
                self.end_headers()
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing url parameter")
        elif path == "/api/download-page":
            query = urllib.parse.parse_qs(parsed_url.query)
            target_url = query.get("url", [None])[0]
            if target_url:
                self.send_response(302)
                self.send_header("Location", target_url)
                self.end_headers()
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing url parameter")
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        if self.path == "/api/extract":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                album_url = data.get("url", "").strip()
                if not album_url:
                    raise ValueError("URL is required")
                
                result = self.extract_gphotos(album_url)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def extract_gphotos(self, album_url):
        req = urllib.request.Request(album_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cookie": "SOCS=CAESEwgDEgk0ODE3NTEzNDQaAnVzIAE"
        })
        try:
           with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                real_url = response.geturl()

                print("REAL URL:", real_url)

                title_match = re.search(r'<title>(.*?)</title>', html)
                title = title_match.group(1) if title_match else "No title"

                print("TITLE:", title)
                print("HTML PREVIEW:")
                print(html[:5000])

        except Exception as e:
          return {
              "error": f"Failed to connect to Google Photos: {e}"
           }

        # 1. Look for video download links
        video_urls = re.findall(r'https?://video-downloads\.googleusercontent\.com/[^\s"\'<>\\]+', html)
        
        cleaned_video_urls = []
        for url in video_urls:
            url = url.replace('\\u0026', '&').replace('&amp;', '&')
            url = re.split(r'["\'\]\)]', url)[0]
            if url not in cleaned_video_urls:
                cleaned_video_urls.append(url)
                
        # 2. Extract album/file title
        title_match = re.search(r'<title>(.*?)</title>', html)
        title = title_match.group(1) if title_match else "Google Photos Media"
        title = title.replace(" - Google Photos", "").replace("Shared album - ", "")

        if cleaned_video_urls:
            return {
                "title": title,
                "original_url": real_url,
                "direct_link": cleaned_video_urls[0],
                "is_video": True
            }
            
        # 3. Fallback: Look for image preview links
        image_urls = re.findall(r'https?://lh3\.googleusercontent\.com/pw/[^\s"\'<>\\]+', html)
        cleaned_image_urls = []
        for url in image_urls:
            url = url.replace('\\u0026', '&').replace('&amp;', '&')
            url = re.split(r'["\'\]\)]', url)[0]
            if url not in cleaned_image_urls:
                cleaned_image_urls.append(url)
        
        if cleaned_image_urls:
            photo_url = cleaned_image_urls[0]
            # Convert preview URL to download URL by appending '=d' (or replacing '=' parameters with '=d')
            if '=' in photo_url:
                photo_url = photo_url.split('=')[0] + "=d"
            else:
                photo_url += "=d"
                
            return {
                "title": title,
                "original_url": real_url,
                "direct_link": photo_url,
                "is_video": False
            }
            
        return {"error": f"No streamable video or download link found. (Resolved URL: {real_url}, Title: {title}). Please verify the link is correct and contains a shared video/photo."}

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"Server running at http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    run(port)
