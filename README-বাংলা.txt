EarnPro — পরীক্ষামূলক সংস্করণ
==============================

এই ZIP-এ আছে:
- index.html : ওয়েবসাইটের পেজ
- server.js  : লগইন, ডেমো ব্যালেন্স, ডেমো উইথড্র ও অ্যাডমিন API
- package.json : সার্ভার চালানোর সেটিং

পরীক্ষামূলক অ্যাডমিন প্যানেল:
আপনার ওয়েবসাইটের শেষে #admin যোগ করুন।
উদাহরণ: https://আপনার-সাইট.onrender.com/#admin
ডিফল্ট অ্যাডমিন পাসওয়ার্ড: androidsujon

Render-এ চালানোর সংক্ষিপ্ত নিয়ম:
1. ZIP Extract করুন।
2. GitHub-এ একটি নতুন repository বানিয়ে এই চারটি ফাইল আপলোড করুন।
3. Render-এ New > Web Service > GitHub repository বাছুন।
4. Runtime: Node
5. Build Command: npm install
6. Start Command: npm start
7. Deploy করুন।

গুরুত্বপূর্ণ:
- এটি শুধু পরীক্ষার জন্য। ডেমো রিওয়ার্ড বাটন চাপলে বিজ্ঞাপন না দেখেই ব্যালেন্স বাড়ে।
- উইথড্র রিকোয়েস্ট শুধু ডেমো; কোনো টাকা পাঠানো হয় না।
- ডেটা JSON ফাইলে রাখা হয়। সাধারণ Render disk ছাড়া redeploy/restart-এ ডেটা হারাতে পারে। স্থায়ী ব্যবহারের আগে persistent disk বা database লাগবে।
- আসল টাকা চালুর আগে Monetag-এর অনুমোদিত server-to-server verification/postback, নিরাপদ database, HTTPS, rate limiting এবং admin password পরিবর্তন বাধ্যতামূলক।
- ডিফল্ট পাসওয়ার্ড androidsujon শুধু পরীক্ষার জন্য। পাবলিক ব্যবহারে এটি রাখবেন না।
