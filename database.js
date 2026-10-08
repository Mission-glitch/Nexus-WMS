const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'nexus_wms.db');
const db = new DatabaseSync(dbPath);

try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) { }

// High-resolution royalty-free Unsplash images and rich descriptions for all 50 SKUs
const skuImagesAndDetails = {
  "SKU-A-001": {
    image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=600&q=80",
    description: "เครื่องดื่มชูกำลังสูตรพรีเมียม คืนความสดชื่นและกระปรี้กระเปร่าทันใจ ผสานวิตามินบี 6 และ บี 12 ขนาดบรรจุแพ็ค 6 กระป๋อง",
    rating: 4.8, reviews: 342
  },
  "SKU-A-002": {
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80",
    description: "น้ำแร่ธรรมชาติ 100% จากแหล่งน้ำใต้ดินธรรมชาติ สะอาด บริสุทธิ์ อุดมด้วยแร่ธาตุจำเป็นต่อร่างกาย ขนาด 1.5 ลิตร",
    rating: 4.9, reviews: 520
  },
  "SKU-A-003": {
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80",
    description: "มันฝรั่งแท้ทอดกรอบ รสคลาสสิก เคี้ยวเพลิน กรอบอร่อย ไม่อมน้ำมัน ขนาดครอบครัว เหมาะสำหรับทุกปาร์ตี้",
    rating: 4.7, reviews: 215
  },
  "SKU-A-004": {
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80",
    description: "บะหมี่กึ่งสำเร็จรูป รสหมูสับ เส้นเหนียวนุ่ม ซุปกลมกล่อมหอมกลิ่นเครื่องเทศ อร่อยง่ายใน 3 นาที",
    rating: 4.8, reviews: 890
  },
  "SKU-A-005": {
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    description: "นมโคสดแท้ 100% ผ่านกรรมวิธีพาสเจอร์ไรซ์ คงคุณค่าสารอาหาร แคลเซียมสูง รสชาติเข้มข้น หอมมัน สดใหม่ทุกวัน",
    rating: 4.9, reviews: 430
  },
  "SKU-A-006": {
    image: "https://images.unsplash.com/photo-1607006314644-88f5f65a1936?auto=format&fit=crop&w=600&q=80",
    description: "สบู่ก้อนบำรุงผิวสูตรธรรมชาติ ฟองเนียนนุ่ม ชำระล้างแบคทีเรียอย่างอ่อนโยน พร้อมกลิ่นหอมผ่อนคลาย แพ็ค 4 ก้อนสุดคุ้ม",
    rating: 4.7, reviews: 180
  },
  "SKU-A-007": {
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80",
    description: "แชมพูสระผมสูตรเย็นสดชื่น ผสานเมนทอล ช่วยลดรังแคและอาการคันศีรษะ ให้ผมสะอาดเบาสบาย ขนาด 450 มล.",
    rating: 4.8, reviews: 310
  },
  "SKU-A-008": {
    image: "https://images.unsplash.com/photo-1559591937-e1032c525f20?auto=format&fit=crop&w=600&q=80",
    description: "ยาสีฟันสูตรสมุนไพรธรรมชาติ ดูแลเหงือกและฟัน ลดกลิ่นปาก ลมหายใจหอมสดชื่นยาวนานตลอดวัน",
    rating: 4.6, reviews: 145
  },
  "SKU-A-009": {
    image: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=600&q=80",
    description: "กระดาษทิชชู่ม้วนหนา 3 ชั้น นุ่มเหนียว ซึมซับดีเยี่ยม ไม่เป็นขุย ไร้สารเรืองแสง บรรจุแพ็ค 6 ม้วน",
    rating: 4.9, reviews: 670
  },
  "SKU-A-010": {
    image: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80",
    description: "ผงซักฟอกสูตรเข้มข้น ขจัดคราบฝังลึกได้อย่างมีประสิทธิภาพ ผ้าขาวสะอาด กลิ่นหอมสดชื่น ขนาด 1.5 กก.",
    rating: 4.7, reviews: 290
  },
  "SKU-A-011": {
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    description: "กาแฟแคปซูล อาราบิก้า 100% คั่วเข้มสไตล์อิตาเลียน ครีมม่าหนานุ่ม หอมละมุน บรรจุกล่อง 10 แคปซูล",
    rating: 4.9, reviews: 480
  },
  "SKU-A-012": {
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
    description: "ชาเขียวออร์แกนิกสกัดเข้มข้น ปราศจากน้ำตาล หอมกลิ่นใบชาแท้จากยอดดอย ชื่นใจ ดับกระหาย ขนาด 500 มล.",
    rating: 4.8, reviews: 360
  },
  "SKU-A-013": {
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    description: "ขนมปังแผ่นเนื้อนุ่ม ละมุนลิ้น อบสดใหม่ทุกวัน เหมาะสำหรับทำแซนด์วิชและขนมปังปิ้งยามเช้า",
    rating: 4.7, reviews: 195
  },
  "SKU-A-014": {
    image: "https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&w=600&q=80",
    description: "ถ่านอัลคาไลน์ขนาด AA พลังงานสูง ใช้งานได้ยาวนาน ป้องกันการรั่วซึม เหมาะสำหรับอุปกรณ์อิเล็กทรอนิกส์ แพ็ค 4 ก้อน",
    rating: 4.8, reviews: 410
  },
  "SKU-A-015": {
    image: "https://images.unsplash.com/photo-1608248597359-25095d36c342?auto=format&fit=crop&w=600&q=80",
    description: "ครีมอาบน้ำสูตรมอยส์เจอร์ไรเซอร์เข้มข้น ผิวนุ่มชุ่มชื้น ไม่แห้งตึง กลิ่นหอมสะอาดติดผิวยาวนาน ขนาด 500 มล.",
    rating: 4.8, reviews: 260
  },
  "SKU-A-016": {
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
    description: "โลชั่นบำรุงผิวกาย ซึมซาบไว ไม่เหนียวเหนอะหนะ ฟื้นฟูผิวแห้งกร้านให้กลับมาเนียนนุ่มกระจ่างใส",
    rating: 4.9, reviews: 380
  },
  "SKU-A-017": {
    image: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
    description: "น้ำยาล้างจานสูตรมะนาวเข้มข้น ขจัดคราบมันและกลิ่นคาวหมดจด ล้างออกง่าย ไม่ทิ้งสารตกค้าง ขนาด 800 มล.",
    rating: 4.7, reviews: 510
  },
  "SKU-A-018": {
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    description: "ฟองน้ำล้างจานใยขัดพิเศษ ทนทาน ไม่ยุ่ยง่าย ขจัดคราบบนภาชนะได้อย่างอ่อนโยน ไม่ทำให้เกิดรอยขีดข่วน แพ็ค 3 ชิ้น",
    rating: 4.8, reviews: 330
  },

  "SKU-B-001": {
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    description: "ซีอิ๊วขาวเห็ดหอม หมักบ่มด้วยวิธีธรรมชาติ รสชาติกลมกล่อม เหมาะสำหรับทุกเมนูผัด ต้ม นึ่ง ขนาด 700 มล.",
    rating: 4.9, reviews: 420
  },
  "SKU-B-002": {
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
    description: "น้ำมันพืชผ่านกรรมวิธีคุณภาพสูง ปราศจากไขมันทรานส์ เหมาะสำหรับการทอดและผัดอาหารให้กรอบอร่อย ขนาด 1 ลิตร",
    rating: 4.8, reviews: 390
  },
  "SKU-B-003": {
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    description: "ข้าวหอมมะลิแท้ 100% คัดพิเศษ เมล็ดเรียวยาว หุงขึ้นหม้อ เหนียวนุ่ม กลิ่นหอมใบเตยธรรมชาติ บรรจุถุง 5 กก.",
    rating: 4.9, reviews: 880
  },
  "SKU-B-004": {
    image: "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=600&q=80",
    description: "ปลากระป๋องในซอสมะเขือเทศเข้มข้น ชิ้นปลาเนื้อแน่น อุดมด้วยโอเมก้า 3 และแคลเซียม แพ็ค 4 กระป๋องสุดคุ้ม",
    rating: 4.7, reviews: 310
  },
  "SKU-B-005": {
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80",
    description: "กาแฟสำเร็จรูปชนิดเกล็ด คัดสรรเมล็ดกาแฟชั้นดี รสชาติเข้มข้น กลมกล่อม ชงง่ายทั้งร้อนและเย็น ขนาดขวดแก้ว",
    rating: 4.8, reviews: 270
  },
  "SKU-B-006": {
    image: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80",
    description: "น้ำตาลทรายขาวบริสุทธิ์ ผลิตจากอ้อยธรรมชาติ เกล็ดละเอียด ละลายง่าย ให้ความหวานพอเหมาะ ขนาด 1 กก.",
    rating: 4.9, reviews: 540
  },
  "SKU-B-007": {
    image: "https://images.unsplash.com/photo-1618941716939-553df3c6c278?auto=format&fit=crop&w=600&q=80",
    description: "พัดลมตั้งโต๊ะขนาด 16 นิ้ว มอเตอร์ทรงพลัง ปรับแรงลมได้ 3 ระดับ กระจายลมเย็นได้ทั่วถึง ดีไซน์มินิมอล ทันสมัย",
    rating: 4.7, reviews: 160
  },
  "SKU-B-008": {
    image: "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80",
    description: "หม้อหุงข้าวไฟฟ้าอัจฉริยะ ความจุ 1.8 ลิตร เคลือบสารกันติด อาหารไม่ติดหม้อ พร้อมระบบอุ่นอัตโนมัติตลอด 24 ชม.",
    rating: 4.8, reviews: 290
  },
  "SKU-B-009": {
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
    description: "ไดร์เป่าผมพลังแรง 1800W พร้อมเทคโนโลยีไอออนลบ ช่วยให้ผมแห้งไว นุ่มสลวย ไม่ชี้ฟู ปรับความร้อนได้ 3 ระดับ",
    rating: 4.8, reviews: 340
  },
  "SKU-B-010": {
    image: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80",
    description: "เตารีดไอน้ำแบบพกพา พลังไอน้ำต่อเนื่องสูง รีดเรียบได้รวดเร็ว ถนอมเนื้อผ้า ใช้งานได้ทั้งแบบแนวราบและแขวนรีด",
    rating: 4.6, reviews: 175
  },
  "SKU-B-011": {
    image: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
    description: "น้ำยาปรับผ้านุ่มสูตรเข้มข้นพิเศษ ให้ผ้านุ่มฟู รีดง่าย กลิ่นหอมดอกไม้ผลิ ติดทนนานตลอดวัน",
    rating: 4.8, reviews: 490
  },
  "SKU-B-012": {
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
    description: "ชุดไม้ถูพื้นไมโครไฟเบอร์ พร้อมถังปั่นสแตนเลสแบบแยกน้ำสะอาด-สกปรก ด้ามจับปรับความยาวได้ ทำความสะอาดง่าย",
    rating: 4.7, reviews: 230
  },
  "SKU-B-013": {
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80",
    description: "เมาส์ไร้สายบลูทูธและ 2.4GHz สวิตช์คลิกเงียบ ดีไซน์กระชับมือ เซ็นเซอร์ความแม่นยำสูง ปรับ DPI ได้ 3 ระดับ",
    rating: 4.9, reviews: 620
  },
  "SKU-B-014": {
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
    description: "คีย์บอร์ดไร้สายขนาดกะทัดรัด ปุ่มกดนุ่มเงียบ เชื่อมต่อได้พร้อมกัน 3 อุปกรณ์ รองรับทั้ง Windows, Mac และ Tablet",
    rating: 4.8, reviews: 450
  },
  "SKU-B-015": {
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
    description: "หูฟังไร้สาย TWS ระบบตัดเสียงรบกวนภายนอก เบสแน่น คุยสายคมชัด แบตเตอรี่ใช้งานได้ยาวนาน 24 ชั่วโมงพร้อมเคสชาร์จ",
    rating: 4.8, reviews: 580
  },
  "SKU-B-016": {
    image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=600&q=80",
    description: "หมอนหนุนเพื่อสุขภาพ เมมโมรี่โฟมแท้ รองรับแนวกระดูกคอและศีรษะอย่างสมดุล ลดอาการปวดคอ หลับสบายตลอดคืน",
    rating: 4.7, reviews: 310
  },

  "SKU-C-001": {
    image: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=600&q=80",
    description: "เตาอบไมโครเวฟดิจิทัล ความจุ 20 ลิตร กำลังไฟ 800W ระบบอุ่นและละลายน้ำแข็งอัตโนมัติ รวดเร็ว ใช้งานง่าย",
    rating: 4.8, reviews: 290
  },
  "SKU-C-002": {
    image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=600&q=80",
    description: "เครื่องดูดฝุ่นไร้สาย แรงดูดไซโคลนทรงพลัง น้ำหนักเบา แบตเตอรี่อึด พร้อมหัวแปรงเปลี่ยนหลากหลายสำหรับการทำความสะอาด",
    rating: 4.9, reviews: 410
  },
  "SKU-C-003": {
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=80",
    description: "สมาร์ททีวี LED ขนาด 32 นิ้ว ความละเอียดระดับ HD รองรับ YouTube, Netflix และแอปสตรีมมิ่งยอดนิยม ลำโพงเสียงกระหึ่ม",
    rating: 4.7, reviews: 180
  },
  "SKU-C-004": {
    image: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=600&q=80",
    description: "ตู้เย็นมินิบาร์ ขนาด 3.1 คิว เย็นเร็ว ประหยัดไฟเบอร์ 5 เสียงเงียบ เหมาะสำหรับห้องนอน คอนโด หรือออฟฟิศ",
    rating: 4.8, reviews: 230
  },
  "SKU-C-005": {
    image: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80",
    description: "น้ำดื่มบริสุทธิ์ลังใหญ่ บรรจุ 24 ขวด (ขวดละ 600 มล.) สะอาด ปลอดภัย ผ่านการกรองระบบรีเวอร์สออสโมซิส",
    rating: 4.9, reviews: 750
  },
  "SKU-C-006": {
    image: "https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=600&q=80",
    description: "กล่องพลาสติกอเนกประสงค์ขนาดใหญ่ มีฝาล็อคและล้อเลื่อน แข็งแรงทนทาน ซ้อนเก็บได้ ประหยัดพื้นที่จัดเก็บบ้าน",
    rating: 4.8, reviews: 340
  },
  "SKU-C-007": {
    image: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80",
    description: "เก้าอี้พับแคมป์ปิ้ง โครงเหล็กหนารับน้ำหนักได้ถึง 120 กก. ผ้า Oxford หนาทนทาน พับเก็บง่ายพร้อมกระเป๋าสะพายพกพา",
    rating: 4.8, reviews: 420
  },
  "SKU-C-008": {
    image: "https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=600&q=80",
    description: "หลอดไฟ LED ขั้ว E27 ขนาด 9W แสงขาว Daylight สว่างถนอมสายตา ประหยัดพลังงานได้ถึง 85% อายุการใช้งานยาวนาน",
    rating: 4.9, reviews: 560
  },
  "SKU-C-009": {
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
    description: "ปลั๊กพ่วงนิรภัย 3 ตา 4 ช่อง มาตรฐาน มอก. พร้อมช่อง USB ชาร์จด่วน สายยาว 3 เมตร ป้องกันไฟกระชากและตัดไฟอัตโนมัติ",
    rating: 4.8, reviews: 630
  },
  "SKU-C-010": {
    image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=600&q=80",
    description: "ชุดกล่องเครื่องมือช่างประจำบ้าน ครบเซ็ต ค้อน คีม ไขควง ประแจ และตลับเมตร เหล็กกล้าเกรดพรีเมียม แข็งแรงทนทาน",
    rating: 4.7, reviews: 290
  },
  "SKU-C-011": {
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80",
    description: "เต็นท์แคมป์ปิ้งสำหรับ 2 คน กางง่ายแบบอัตโนมัติ ผ้ากันน้ำและกันลม มีตาข่ายระบายอากาศและป้องกันยุงแมลง",
    rating: 4.8, reviews: 310
  },
  "SKU-C-012": {
    image: "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=600&q=80",
    description: "ถุงนอนกันหนาว นุ่มสบาย ทนอุณหภูมิได้ถึง 5 องศาเซลเซียส น้ำหนักเบา พับเก็บใส่ถุงพกพาสะดวก เหมาะกับการเดินป่า",
    rating: 4.7, reviews: 180
  },
  "SKU-C-013": {
    image: "https://images.unsplash.com/photo-1584990347449-383794323719?auto=format&fit=crop&w=600&q=80",
    description: "กระทะไฟฟ้าอเนกประสงค์ ชาบู ปิ้งย่างในหนึ่งเดียว เคลือบสารไม่ติดกระทะ ปรับระดับความร้อนได้ ร้อนไว ทำความสะอาดง่าย",
    rating: 4.8, reviews: 410
  },
  "SKU-C-014": {
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
    description: "ลำโพงบลูทูธพกพา พลังเสียงกระหึ่ม 360 องศา พร้อมไฟ RGB วิบวับตามจังหวะเพลง กันน้ำระดับ IPX5 แบตอึด 12 ชม.",
    rating: 4.9, reviews: 520
  },
  "SKU-C-015": {
    image: "https://images.unsplash.com/photo-1580481077195-722a49007f08?auto=format&fit=crop&w=600&q=80",
    description: "เก้าอี้เพื่อสุขภาพ Ergonomic ปรับระดับพนักพิงและที่วางแขนได้ รองรับแผ่นหลังระบายอากาศ ลดอาการออฟฟิศซินโดรม",
    rating: 4.9, reviews: 360
  },
  "SKU-C-016": {
    image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=600&q=80",
    description: "โต๊ะญี่ปุ่นพับได้ ไม้แท้เคลือบกันน้ำ ขอบมนปลอดภัย พับเก็บแนบชิด ประหยัดพื้นที่ เหมาะสำหรับวางโน้ตบุ๊กหรือทานอาหาร",
    rating: 4.8, reviews: 440
  }
};

function initDb() {
  // 1. Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      cat TEXT NOT NULL,
      icon TEXT,
      image TEXT,
      description TEXT,
      rating REAL DEFAULT 4.8,
      reviews INTEGER DEFAULT 120,
      price REAL NOT NULL,
      loc TEXT NOT NULL,
      zone TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      reserve INTEGER NOT NULL DEFAULT 0,
      picks INTEGER NOT NULL DEFAULT 0,
      weight REAL NOT NULL DEFAULT 1,
      size TEXT NOT NULL DEFAULT 'S',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate columns if table already existed without them
  try { db.exec('ALTER TABLE products ADD COLUMN image TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE products ADD COLUMN description TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE products ADD COLUMN rating REAL DEFAULT 4.8;'); } catch (e) { }
  try { db.exec('ALTER TABLE products ADD COLUMN reviews INTEGER DEFAULT 120;'); } catch (e) { }

  // 2. Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      items_json TEXT NOT NULL,
      zones_json TEXT NOT NULL,
      zones_completed_json TEXT NOT NULL DEFAULT '[]',
      put_wall_slot TEXT NOT NULL,
      mhe_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Queued',
      started_at INTEGER,
      packed_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  // 3. Waves table
  db.exec(`
    CREATE TABLE IF NOT EXISTS waves (
      id TEXT PRIMARY KEY,
      zone TEXT NOT NULL,
      pick_list_json TEXT NOT NULL,
      orders_json TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // 4. Packed history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS packed_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      put_wall_slot TEXT NOT NULL,
      item_summary TEXT NOT NULL,
      lead_time_ms INTEGER NOT NULL,
      packed_at INTEGER NOT NULL
    );
  `);

  // 5. Workers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      clocked_in INTEGER NOT NULL DEFAULT 0,
      total_time_ms INTEGER NOT NULL DEFAULT 0,
      last_clock_in_at INTEGER,
      units_picked INTEGER NOT NULL DEFAULT 0,
      waves_completed INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 6. QC Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS qc_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      inspector_name TEXT NOT NULL,
      status TEXT NOT NULL,
      defect_type TEXT,
      defect_notes TEXT,
      items_checked INTEGER NOT NULL DEFAULT 1,
      inspected_at INTEGER NOT NULL
    );
  `);

  // 7. Purchase Plans (Procurement) table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      supplier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      items_json TEXT NOT NULL,
      total_qty INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      eta_ms INTEGER,
      eta_minutes INTEGER DEFAULT 5,
      ordered_at INTEGER,
      received_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // 8. Location Moves (Audit trail for SKU relocations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku_id TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      from_loc TEXT NOT NULL,
      to_loc TEXT NOT NULL,
      from_zone TEXT NOT NULL,
      to_zone TEXT NOT NULL,
      reason TEXT,
      moved_by TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate columns for orders if missing
  try { db.exec("ALTER TABLE orders ADD COLUMN backorder_items_json TEXT DEFAULT '{}';"); } catch (e) { }

  // Check if products need seeding
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (count === 0) {
    seedProducts();
  } else {
    // Update existing seeded products with image and description if missing
    updateExistingProductImages();
  }

  // Check if default worker exists
  const workerCount = db.prepare('SELECT COUNT(*) as count FROM workers').get().count;
  if (workerCount === 0) {
    db.prepare(`
      INSERT INTO workers (id, name, clocked_in, total_time_ms, last_clock_in_at, units_picked, waves_completed)
      VALUES (?, ?, 0, 0, NULL, 0, 0)
    `).run('NEXUS-001', 'สมชาย ว่องไว');
  }

  // Seed sample QC & packed history if empty
  seedSampleQcAndHistory();

  // Seed sample Purchase Plans if empty
  seedSamplePurchasePlans();

  // Seed sample Location Moves if empty
  seedSampleLocationMoves();
}

function seedSamplePurchasePlans() {
  const count = db.prepare('SELECT COUNT(*) as count FROM purchase_plans').get().count;
  if (count === 0) {
    const now = Date.now();
    const sampleItems1 = [
      { skuId: 'SKU-A-001', name: 'เครื่องดื่มชูกำลัง (Pack 6)', barcode: '8850000000010', qty: 25, unitPrice: 65, totalCost: 1625, reason: 'เติมสต็อกเครื่องดื่มหมวด A ยอดขายสูง' },
      { skuId: 'SKU-A-002', name: 'น้ำแร่ธรรมชาติ 1.5L', barcode: '8850000000027', qty: 30, unitPrice: 15, totalCost: 450, reason: 'เติมสต็อกน้ำดื่มขายดีประจำวัน' }
    ];
    const totalCost1 = sampleItems1.reduce((sum, i) => sum + i.totalCost, 0);
    const totalQty1 = sampleItems1.reduce((sum, i) => sum + i.qty, 0);
    const etaMs1 = now + (3 * 60 * 1000); // 3 minutes ETA for live demo

    db.prepare(`
      INSERT INTO purchase_plans (id, title, supplier, status, items_json, total_qty, total_cost, eta_ms, eta_minutes, ordered_at, received_at, notes, created_at)
      VALUES (?, ?, ?, 'Ordered', ?, ?, ?, ?, 3, ?, NULL, ?, ?)
    `).run(
      'PO-2026-101',
      'แผนสั่งซื้อด่วน: เติมสต็อกเครื่องดื่มหมวดขายดี',
      'Thai Beverage & FMCG Distribution Co., Ltd.',
      JSON.stringify(sampleItems1),
      totalQty1,
      totalCost1,
      etaMs1,
      now - 60000,
      'คำสั่งซื้อเร่งด่วนเพื่อป้องกันสต็อกขาดมือ',
      now - 60000
    );

    const sampleItems2 = [
      { skuId: 'SKU-A-009', name: 'กระดาษทิชชู่ม้วน (Pack 6)', barcode: '8850000000096', qty: 20, unitPrice: 89, totalCost: 1780, reason: 'เตรียมสำรองสินค้าของใช้ในบ้าน' },
      { skuId: 'SKU-B-003', name: 'ข้าวหอมมะลิ 5kg', barcode: '8850000000218', qty: 15, unitPrice: 199, totalCost: 2985, reason: 'เตรียมสำรองสินค้าหมวด B' }
    ];
    const totalCost2 = sampleItems2.reduce((sum, i) => sum + i.totalCost, 0);
    const totalQty2 = sampleItems2.reduce((sum, i) => sum + i.qty, 0);

    db.prepare(`
      INSERT INTO purchase_plans (id, title, supplier, status, items_json, total_qty, total_cost, eta_ms, eta_minutes, ordered_at, received_at, notes, created_at)
      VALUES (?, ?, ?, 'Draft', ?, ?, ?, NULL, 5, NULL, NULL, ?, ?)
    `).run(
      'PO-2026-102',
      'แผนจัดซื้อสินค้าของใช้ในบ้าน & ข้าวสารประจำสัปดาห์',
      'Siam Distribution Logistics Thailand',
      JSON.stringify(sampleItems2),
      totalQty2,
      totalCost2,
      'รอตรวจนับและสรุปงบประมาณรอบถัดไป',
      now - (2 * 3600 * 1000)
    );
  }
}

function seedSampleQcAndHistory() {
  const qcCount = db.prepare('SELECT COUNT(*) as count FROM qc_logs').get().count;
  if (qcCount === 0) {
    const now = Date.now();
    const sampleLogs = [
      { order_id: 'ORD-9801', inspector: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect: 'NONE', notes: 'สินค้าครบถ้วน บาร์โค้ดถูกต้อง', items: 3, offset: 45 * 60 * 1000 },
      { order_id: 'ORD-9802', inspector: 'สมศรี จัดของไว', status: 'PASS', defect: 'NONE', notes: 'ตรวจสอบผ่าน 100%', items: 2, offset: 38 * 60 * 1000 },
      { order_id: 'ORD-9803', inspector: 'วิชัย แพ็กแม่นยำ', status: 'FAIL', defect: 'WRONG_SKU', notes: 'หยิบผิดกล่อง จาก SKU-A-003 เป็น SKU-A-004', items: 4, offset: 30 * 60 * 1000 },
      { order_id: 'ORD-9804', inspector: 'สมชาย ว่องไว', status: 'PASS', defect: 'NONE', notes: 'ตรวจเช็คเรียบร้อย', items: 5, offset: 25 * 60 * 1000 },
      { order_id: 'ORD-9805', inspector: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect: 'NONE', notes: 'สภาพกล่องและฉลากสมบูรณ์', items: 1, offset: 18 * 60 * 1000 },
      { order_id: 'ORD-9806', inspector: 'สมศรี จัดของไว', status: 'PASS', defect: 'NONE', notes: 'ผ่าน QC', items: 3, offset: 12 * 60 * 1000 },
      { order_id: 'ORD-9807', inspector: 'สมชาย ว่องไว', status: 'FAIL', defect: 'DAMAGED_ITEM', notes: 'มุมกล่องพัสดุบุบ มีรอยกดทับ', items: 2, offset: 6 * 60 * 1000 },
      { order_id: 'ORD-9808', inspector: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect: 'NONE', notes: 'ผ่านการตรวจสอบคุณภาพ', items: 4, offset: 2 * 60 * 1000 }
    ];

    const insertQc = db.prepare(`
      INSERT INTO qc_logs (order_id, inspector_name, status, defect_type, defect_notes, items_checked, inspected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    sampleLogs.forEach(log => {
      insertQc.run(log.order_id, log.inspector, log.status, log.defect, log.notes, log.items, now - log.offset);
    });
  }

  const histCount = db.prepare('SELECT COUNT(*) as count FROM packed_history').get().count;
  if (histCount === 0) {
    const now = Date.now();
    const sampleHistory = [
      { order_id: 'ORD-9801', slot: 'PW-1', summary: '3 SKU / 6 ชิ้น', lead_ms: 142000, offset: 45 * 60 * 1000 },
      { order_id: 'ORD-9802', slot: 'PW-3', summary: '2 SKU / 4 ชิ้น', lead_ms: 98000, offset: 38 * 60 * 1000 },
      { order_id: 'ORD-9804', slot: 'PW-5', summary: '5 SKU / 8 ชิ้น', lead_ms: 215000, offset: 25 * 60 * 1000 },
      { order_id: 'ORD-9805', slot: 'PW-2', summary: '1 SKU / 2 ชิ้น', lead_ms: 76000, offset: 18 * 60 * 1000 },
      { order_id: 'ORD-9806', slot: 'PW-7', summary: '3 SKU / 5 ชิ้น', lead_ms: 165000, offset: 12 * 60 * 1000 },
      { order_id: 'ORD-9808', slot: 'PW-4', summary: '4 SKU / 7 ชิ้น', lead_ms: 188000, offset: 2 * 60 * 1000 }
    ];

    const insertHist = db.prepare(`
      INSERT INTO packed_history (order_id, put_wall_slot, item_summary, lead_time_ms, packed_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    sampleHistory.forEach(h => {
      insertHist.run(h.order_id, h.slot, h.summary, h.lead_ms, now - h.offset);
    });
  }
}

function seedSampleLocationMoves() {
  const count = db.prepare('SELECT COUNT(*) as count FROM location_moves').get().count;
  if (count === 0) {
    const now = Date.now();
    const sampleMoves = [
      { sku_id: 'SKU-A-001', sku_name: 'เครื่องดื่มชูกำลัง (Pack 6)', from_loc: 'A-04-03', to_loc: 'A-01-01', from_zone: 'A', to_zone: 'A', reason: 'ย้ายเข้าใกล้โต๊ะแพ็ก (Fast-mover ABC)', moved_by: 'สมชาย ว่องไว', offset: 120 * 60 * 1000 },
      { sku_id: 'SKU-B-008', sku_name: 'หม้อหุงข้าว 1.8L', from_loc: 'B-05-01', to_loc: 'B-03-02', from_zone: 'B', to_zone: 'B', reason: 'จัดกลุ่มหมวดหมู่อุปกรณ์ครัว', moved_by: 'วิชัย แพ็กแม่นยำ', offset: 65 * 60 * 1000 },
      { sku_id: 'SKU-C-001', sku_name: 'ไมโครเวฟ 20L', from_loc: 'C-04-02', to_loc: 'C-01-01', from_zone: 'C', to_zone: 'C', reason: 'ปรับพื้นที่รองรับสินค้าชิ้นใหญ่ (Bulky)', moved_by: 'สมศรี จัดของไว', offset: 25 * 60 * 1000 }
    ];

    const insertMove = db.prepare(`
      INSERT INTO location_moves (sku_id, sku_name, from_loc, to_loc, from_zone, to_zone, reason, moved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sampleMoves.forEach(m => {
      insertMove.run(m.sku_id, m.sku_name, m.from_loc, m.to_loc, m.from_zone, m.to_zone, m.reason, m.moved_by, now - m.offset);
    });
  }
}

function updateExistingProductImages() {
  const updateStmt = db.prepare(`
    UPDATE products
    SET image = ?, description = ?, rating = ?, reviews = ?
    WHERE id = ?
  `);

  for (const [id, details] of Object.entries(skuImagesAndDetails)) {
    updateStmt.run(details.image, details.description, details.rating, details.reviews, id);
  }
}

function generateEAN13(index) {
  let base = "885" + String(index).padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  return base + ((10 - (sum % 10)) % 10);
}

function seedProducts() {
  const initialProducts = [
    { id: "SKU-A-001", cat: "อาหารและเครื่องดื่ม", icon: "🥤", price: 65, name: "เครื่องดื่มชูกำลัง (Pack 6)", loc: "A-01-01", zone: "A", stock: 50, picks: 120, reserve: 200, weight: 3, size: 'M' },
    { id: "SKU-A-002", cat: "อาหารและเครื่องดื่ม", icon: "💧", price: 15, name: "น้ำแร่ธรรมชาติ 1.5L", loc: "A-01-02", zone: "A", stock: 40, picks: 95, reserve: 150, weight: 1.5, size: 'M' },
    { id: "SKU-A-003", cat: "อาหารและเครื่องดื่ม", icon: "🥔", price: 30, name: "ขนมมันฝรั่งทอดกรอบ", loc: "A-01-03", zone: "A", stock: 60, picks: 88, reserve: 300, weight: 0.2, size: 'S' },
    { id: "SKU-A-004", cat: "อาหารและเครื่องดื่ม", icon: "🍜", price: 12, name: "บะหมี่กึ่งสำเร็จรูป รสหมูสับ", loc: "A-02-01", zone: "A", stock: 55, picks: 74, reserve: 180, weight: 0.1, size: 'S' },
    { id: "SKU-A-005", cat: "อาหารและเครื่องดื่ม", icon: "🥛", price: 45, name: "นมสดพาสเจอไรซ์", loc: "A-02-02", zone: "A", stock: 30, picks: 62, reserve: 100, weight: 1, size: 'S' },
    { id: "SKU-A-006", cat: "สุขภาพและความงาม", icon: "🧼", price: 55, name: "สบู่ก้อนแพ็ค 4", loc: "A-02-03", zone: "A", stock: 45, picks: 50, reserve: 160, weight: 0.5, size: 'S' },
    { id: "SKU-A-007", cat: "สุขภาพและความงาม", icon: "🧴", price: 129, name: "แชมพูสูตรเย็น 450ml", loc: "A-03-01", zone: "A", stock: 35, picks: 45, reserve: 120, weight: 0.6, size: 'S' },
    { id: "SKU-A-008", cat: "สุขภาพและความงาม", icon: "🪥", price: 49, name: "ยาสีฟันสูตรสมุนไพร", loc: "A-03-02", zone: "A", stock: 50, picks: 40, reserve: 100, weight: 0.2, size: 'S' },
    { id: "SKU-A-009", cat: "ของใช้ในบ้าน", icon: "🧻", price: 89, name: "กระดาษทิชชู่ม้วน (Pack 6)", loc: "A-03-03", zone: "A", stock: 20, picks: 35, reserve: 80, weight: 0.8, size: 'M' },
    { id: "SKU-A-010", cat: "ของใช้ในบ้าน", icon: "🧺", price: 159, name: "ผงซักฟอก 1.5kg", loc: "A-04-01", zone: "A", stock: 25, picks: 33, reserve: 90, weight: 1.5, size: 'M' },
    { id: "SKU-A-011", cat: "อาหารและเครื่องดื่ม", icon: "☕", price: 250, name: "กาแฟแคปซูล (10 ชิ้น)", loc: "A-04-02", zone: "A", stock: 20, picks: 30, reserve: 50, weight: 0.3, size: 'S' },
    { id: "SKU-A-012", cat: "อาหารและเครื่องดื่ม", icon: "🍵", price: 25, name: "ชาเขียวขวด 500ml", loc: "A-04-03", zone: "A", stock: 45, picks: 28, reserve: 100, weight: 0.5, size: 'S' },
    { id: "SKU-A-013", cat: "อาหารและเครื่องดื่ม", icon: "🍞", price: 40, name: "ขนมปังแผ่นแถว", loc: "A-05-01", zone: "A", stock: 15, picks: 25, reserve: 40, weight: 0.4, size: 'S' },
    { id: "SKU-A-014", cat: "อุปกรณ์ไอที", icon: "🔋", price: 85, name: "แบตเตอรี่ AA (Pack 4)", loc: "A-05-02", zone: "A", stock: 60, picks: 22, reserve: 150, weight: 0.1, size: 'S' },
    { id: "SKU-A-015", cat: "สุขภาพและความงาม", icon: "🧴", price: 150, name: "ครีมอาบน้ำ 500ml", loc: "A-05-03", zone: "A", stock: 35, picks: 20, reserve: 80, weight: 0.6, size: 'S' },
    { id: "SKU-A-016", cat: "สุขภาพและความงาม", icon: "🧴", price: 199, name: "บอดี้โลชั่นทาผิว", loc: "A-06-01", zone: "A", stock: 25, picks: 18, reserve: 50, weight: 0.4, size: 'S' },
    { id: "SKU-A-017", cat: "ของใช้ในบ้าน", icon: "🧼", price: 45, name: "น้ำยาล้างจาน 800ml", loc: "A-06-02", zone: "A", stock: 40, picks: 15, reserve: 100, weight: 0.9, size: 'S' },
    { id: "SKU-A-018", cat: "ของใช้ในบ้าน", icon: "🧽", price: 20, name: "ฟองน้ำล้างจาน (Pack 3)", loc: "A-06-03", zone: "A", stock: 50, picks: 12, reserve: 120, weight: 0.1, size: 'S' },

    { id: "SKU-B-001", cat: "อาหารและเครื่องดื่ม", icon: "🫙", price: 45, name: "ซอสถั่วเหลือง 700ml", loc: "B-01-01", zone: "B", stock: 30, picks: 30, reserve: 120, weight: 0.8, size: 'S' },
    { id: "SKU-B-002", cat: "อาหารและเครื่องดื่ม", icon: "🫙", price: 55, name: "น้ำมันพืช 1L", loc: "B-01-02", zone: "B", stock: 40, picks: 28, reserve: 100, weight: 1, size: 'S' },
    { id: "SKU-B-003", cat: "อาหารและเครื่องดื่ม", icon: "🍚", price: 199, name: "ข้าวหอมมะลิ 5kg", loc: "B-01-03", zone: "B", stock: 15, picks: 25, reserve: 80, weight: 5, size: 'M' },
    { id: "SKU-B-004", cat: "อาหารและเครื่องดื่ม", icon: "🐟", price: 65, name: "ปลากระป๋อง (Pack 4)", loc: "B-02-01", zone: "B", stock: 35, picks: 22, reserve: 90, weight: 0.8, size: 'S' },
    { id: "SKU-B-005", cat: "อาหารและเครื่องดื่ม", icon: "☕", price: 120, name: "กาแฟสำเร็จรูปขวด", loc: "B-02-02", zone: "B", stock: 25, picks: 20, reserve: 60, weight: 0.4, size: 'S' },
    { id: "SKU-B-006", cat: "อาหารและเครื่องดื่ม", icon: "🍬", price: 35, name: "น้ำตาลทราย 1kg", loc: "B-02-03", zone: "B", stock: 45, picks: 18, reserve: 100, weight: 1, size: 'S' },
    { id: "SKU-B-007", cat: "เครื่องใช้ไฟฟ้า", icon: "🌪️", price: 590, name: "พัดลมตั้งโต๊ะ 16 นิ้ว", loc: "B-03-01", zone: "B", stock: 10, picks: 15, reserve: 40, weight: 4.5, size: 'Bulky' },
    { id: "SKU-B-008", cat: "เครื่องใช้ไฟฟ้า", icon: "🍚", price: 890, name: "หม้อหุงข้าว 1.8L", loc: "B-03-02", zone: "B", stock: 8, picks: 12, reserve: 30, weight: 3, size: 'Bulky' },
    { id: "SKU-B-009", cat: "เครื่องใช้ไฟฟ้า", icon: "💨", price: 450, name: "ไดร์เป่าผม", loc: "B-03-03", zone: "B", stock: 12, picks: 10, reserve: 25, weight: 1.2, size: 'M' },
    { id: "SKU-B-010", cat: "เครื่องใช้ไฟฟ้า", icon: "👔", price: 690, name: "เตารีดไอน้ำ", loc: "B-04-01", zone: "B", stock: 15, picks: 9, reserve: 30, weight: 2, size: 'M' },
    { id: "SKU-B-011", cat: "ของใช้ในบ้าน", icon: "🌸", price: 65, name: "น้ำยาปรับผ้านุ่ม", loc: "B-04-02", zone: "B", stock: 30, picks: 8, reserve: 60, weight: 0.7, size: 'S' },
    { id: "SKU-B-012", cat: "ของใช้ในบ้าน", icon: "🧹", price: 199, name: "ไม้ถูพื้นพร้อมถังบีบ", loc: "B-04-03", zone: "B", stock: 12, picks: 7, reserve: 30, weight: 2.5, size: 'M' },
    { id: "SKU-B-013", cat: "อุปกรณ์ไอที", icon: "🖱️", price: 290, name: "เมาส์ไร้สาย Bluetooth", loc: "B-05-01", zone: "B", stock: 25, picks: 7, reserve: 50, weight: 0.2, size: 'S' },
    { id: "SKU-B-014", cat: "อุปกรณ์ไอที", icon: "⌨️", price: 450, name: "คีย์บอร์ดไร้สาย", loc: "B-05-02", zone: "B", stock: 20, picks: 6, reserve: 40, weight: 0.6, size: 'S' },
    { id: "SKU-B-015", cat: "อุปกรณ์ไอที", icon: "🎧", price: 890, name: "หูฟังไร้สาย TWS", loc: "B-05-03", zone: "B", stock: 15, picks: 5, reserve: 30, weight: 0.2, size: 'S' },
    { id: "SKU-B-016", cat: "ของใช้ในบ้าน", icon: "🛏️", price: 150, name: "หมอนหนุนเพื่อสุขภาพ", loc: "B-06-01", zone: "B", stock: 18, picks: 4, reserve: 40, weight: 1, size: 'M' },

    { id: "SKU-C-001", cat: "เครื่องใช้ไฟฟ้า", icon: "🍲", price: 1590, name: "ไมโครเวฟ 20L", loc: "C-01-01", zone: "C", stock: 5, picks: 8, reserve: 20, weight: 11, size: 'Bulky' },
    { id: "SKU-C-002", cat: "เครื่องใช้ไฟฟ้า", icon: "🧹", price: 2990, name: "เครื่องดูดฝุ่นไร้สาย", loc: "C-01-02", zone: "C", stock: 7, picks: 7, reserve: 15, weight: 3.5, size: 'Bulky' },
    { id: "SKU-C-003", cat: "เครื่องใช้ไฟฟ้า", icon: "📺", price: 4500, name: "ทีวี LED 32 นิ้ว", loc: "C-01-03", zone: "C", stock: 4, picks: 5, reserve: 10, weight: 6, size: 'Bulky' },
    { id: "SKU-C-004", cat: "เครื่องใช้ไฟฟ้า", icon: "❄️", price: 3200, name: "ตู้เย็นมินิ 3.1 คิว", loc: "C-02-01", zone: "C", stock: 3, picks: 4, reserve: 8, weight: 20, size: 'Bulky' },
    { id: "SKU-C-005", cat: "อาหารและเครื่องดื่ม", icon: "💧", price: 150, name: "น้ำดื่มลังใหญ่ (24 ขวด)", loc: "C-02-02", zone: "C", stock: 10, picks: 3, reserve: 40, weight: 15, size: 'Bulky' },
    { id: "SKU-C-006", cat: "ของใช้ในบ้าน", icon: "📦", price: 299, name: "กล่องพลาสติกอเนกประสงค์", loc: "C-02-03", zone: "C", stock: 20, picks: 3, reserve: 50, weight: 1.5, size: 'M' },
    { id: "SKU-C-007", cat: "แคมป์ปิ้งและเครื่องมือ", icon: "🪑", price: 350, name: "เก้าอี้พับลานกางเต็นท์", loc: "C-03-01", zone: "C", stock: 15, picks: 2, reserve: 30, weight: 2.5, size: 'Bulky' },
    { id: "SKU-C-008", cat: "เครื่องใช้ไฟฟ้า", icon: "💡", price: 89, name: "หลอดไฟ LED 9W", loc: "C-03-02", zone: "C", stock: 40, picks: 2, reserve: 100, weight: 0.1, size: 'S' },
    { id: "SKU-C-009", cat: "อุปกรณ์ไอที", icon: "🔌", price: 199, name: "ปลั๊กพ่วง 3 ตา", loc: "C-03-03", zone: "C", stock: 25, picks: 1, reserve: 60, weight: 0.5, size: 'S' },
    { id: "SKU-C-010", cat: "แคมป์ปิ้งและเครื่องมือ", icon: "🧰", price: 890, name: "ชุดเครื่องมือช่าง", loc: "C-04-01", zone: "C", stock: 8, picks: 1, reserve: 20, weight: 4, size: 'M' },
    { id: "SKU-C-011", cat: "แคมป์ปิ้งและเครื่องมือ", icon: "⛺", price: 1290, name: "เต็นท์แคมป์ปิ้ง 2 คน", loc: "C-04-02", zone: "C", stock: 6, picks: 1, reserve: 15, weight: 3, size: 'M' },
    { id: "SKU-C-012", cat: "แคมป์ปิ้งและเครื่องมือ", icon: "🛌", price: 590, name: "ถุงนอนกันหนาว", loc: "C-04-03", zone: "C", stock: 10, picks: 1, reserve: 20, weight: 1.5, size: 'M' },
    { id: "SKU-C-013", cat: "เครื่องใช้ไฟฟ้า", icon: "🍳", price: 790, name: "กระทะไฟฟ้าอเนกประสงค์", loc: "C-05-01", zone: "C", stock: 8, picks: 1, reserve: 20, weight: 2, size: 'M' },
    { id: "SKU-C-014", cat: "อุปกรณ์ไอที", icon: "🔊", price: 1590, name: "ลำโพงบลูทูธ ปาร์ตี้", loc: "C-05-02", zone: "C", stock: 5, picks: 1, reserve: 10, weight: 5, size: 'Bulky' },
    { id: "SKU-C-015", cat: "ของใช้ในบ้าน", icon: "💺", price: 1890, name: "เก้าอี้ทำงานเพื่อสุขภาพ", loc: "C-05-03", zone: "C", stock: 4, picks: 0, reserve: 10, weight: 12, size: 'Bulky' },
    { id: "SKU-C-016", cat: "ของใช้ในบ้าน", icon: "🪑", price: 650, name: "โต๊ะพับญี่ปุ่น", loc: "C-06-01", zone: "C", stock: 15, picks: 0, reserve: 30, weight: 3, size: 'M' }
  ];

  const stmt = db.prepare(`
    INSERT INTO products (id, barcode, name, cat, icon, image, description, rating, reviews, price, loc, zone, stock, reserve, picks, weight, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialProducts.forEach((p, idx) => {
    const barcode = generateEAN13(idx + 1);
    const details = skuImagesAndDetails[p.id] || {
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
      description: p.name,
      rating: 4.8,
      reviews: 150
    };

    stmt.run(
      p.id,
      barcode,
      p.name,
      p.cat,
      p.icon,
      details.image,
      details.description,
      details.rating,
      details.reviews,
      p.price,
      p.loc,
      p.zone,
      p.stock,
      p.reserve,
      p.picks,
      p.weight,
      p.size
    );
  });
}

// DAO Methods
const ProductDAO = {
  getAll: () => db.prepare('SELECT * FROM products ORDER BY loc ASC').all(),
  getById: (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id),
  getByBarcodeOrId: (code) => {
    const norm = code.toUpperCase();
    return db.prepare('SELECT * FROM products WHERE barcode = ? OR UPPER(id) = ?').get(code, norm);
  },
  addOrUpdateInbound: ({ barcode, name, cat, price, loc, zone, qty, image, description }) => {
    const existing = db.prepare('SELECT * FROM products WHERE barcode = ? OR UPPER(id) = ?').get(barcode, barcode.toUpperCase());
    const finalImage = image || "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";
    const finalDesc = description || name;

    if (existing) {
      db.prepare(`
        UPDATE products
        SET stock = stock + ?, price = ?, name = ?, cat = ?, loc = ?, zone = ?, image = COALESCE(?, image), description = COALESCE(?, description)
        WHERE id = ?
      `).run(qty, price, name, cat, loc, zone, image || null, description || null, existing.id);
      return { action: 'updated', product: ProductDAO.getById(existing.id) };
    } else {
      const newId = 'SKU-NEW-' + Math.floor(1000 + Math.random() * 9000);
      db.prepare(`
        INSERT INTO products (id, barcode, name, cat, icon, image, description, rating, reviews, price, loc, zone, stock, reserve, picks, weight, size)
        VALUES (?, ?, ?, ?, '📦', ?, ?, 5.0, 1, ?, ?, ?, ?, 0, 0, 1, 'S')
      `).run(newId, barcode, name, cat, finalImage, finalDesc, price, loc, zone, qty);
      return { action: 'created', product: ProductDAO.getById(newId) };
    }
  },
  decrementStockIncrementPicks: (id) => {
    db.prepare('UPDATE products SET stock = MAX(0, stock - 1), picks = picks + 1 WHERE id = ?').run(id);
    return ProductDAO.getById(id);
  },
  decrementStockIncrementPicksBy: (id, qty = 1) => {
    const amount = Math.max(1, parseInt(qty, 10) || 1);
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?), picks = picks + ? WHERE id = ?').run(amount, amount, id);
    return ProductDAO.getById(id);
  },
  addStock: (id, qty, target = 'stock') => {
    const amount = parseInt(qty, 10);
    if (isNaN(amount) || amount <= 0) return null;
    if (target === 'reserve') {
      db.prepare('UPDATE products SET reserve = reserve + ? WHERE id = ?').run(amount, id);
    } else {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(amount, id);
    }
    return ProductDAO.getById(id);
  },
  relocateProduct: ({ id, newLoc, newZone, reason, movedBy }) => {
    const existing = ProductDAO.getById(id);
    if (!existing) return null;
    const cleanLoc = (newLoc || '').trim().toUpperCase();
    const cleanZone = (newZone || cleanLoc.charAt(0) || 'A').toUpperCase();
    const cleanReason = (reason || 'ย้ายปรับปรุงพื้นที่จัดเก็บ').trim();
    const cleanMovedBy = (movedBy || 'เจ้าหน้าที่คลัง').trim();
    const now = Date.now();

    // 1. Update product table
    db.prepare('UPDATE products SET loc = ?, zone = ? WHERE id = ?').run(cleanLoc, cleanZone, id);

    // 2. Insert into location_moves audit table
    const moveInfo = db.prepare(`
      INSERT INTO location_moves (sku_id, sku_name, from_loc, to_loc, from_zone, to_zone, reason, moved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(existing.id, existing.name, existing.loc, cleanLoc, existing.zone, cleanZone, cleanReason, cleanMovedBy, now);

    // 3. Update any active uncompleted waves referencing this SKU so pickers are guided to the new location
    let wavesUpdated = 0;
    try {
      const openWaves = db.prepare('SELECT * FROM waves WHERE completed = 0').all();
      openWaves.forEach(w => {
        let pList = JSON.parse(w.pick_list_json);
        let changed = false;
        pList.forEach(t => {
          if (t.skuId === id) {
            t.loc = cleanLoc;
            t.zone = cleanZone;
            changed = true;
          }
        });
        if (changed) {
          db.prepare('UPDATE waves SET pick_list_json = ? WHERE id = ?').run(JSON.stringify(pList), w.id);
          wavesUpdated++;
        }
      });
    } catch (e) {
      console.error('Error updating active waves during relocation:', e);
    }

    const updatedProduct = ProductDAO.getById(id);
    return {
      product: updatedProduct,
      wavesUpdated,
      moveRecord: {
        id: moveInfo.lastInsertRowid,
        sku_id: existing.id,
        sku_name: existing.name,
        from_loc: existing.loc,
        to_loc: cleanLoc,
        from_zone: existing.zone,
        to_zone: cleanZone,
        reason: cleanReason,
        moved_by: cleanMovedBy,
        created_at: now
      }
    };
  }
};

const OrderDAO = {
  getAll: () => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return rows.map(r => ({
      orderId: r.id,
      items: JSON.parse(r.items_json),
      zones: JSON.parse(r.zones_json),
      zonesCompleted: JSON.parse(r.zones_completed_json),
      putWallSlot: r.put_wall_slot,
      mhe: JSON.parse(r.mhe_json),
      status: r.status,
      backorderItems: JSON.parse(r.backorder_items_json || '{}'),
      startedAt: r.started_at,
      packedAt: r.packed_at,
      createdAt: r.created_at
    }));
  },
  getById: (id) => {
    const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!r) return null;
    return {
      orderId: r.id,
      items: JSON.parse(r.items_json),
      zones: JSON.parse(r.zones_json),
      zonesCompleted: JSON.parse(r.zones_completed_json),
      putWallSlot: r.put_wall_slot,
      mhe: JSON.parse(r.mhe_json),
      status: r.status,
      backorderItems: JSON.parse(r.backorder_items_json || '{}'),
      startedAt: r.started_at,
      packedAt: r.packed_at,
      createdAt: r.created_at
    };
  },
  create: ({ orderId, items, zones, putWallSlot, mhe, status = 'Queued', backorderItems = {} }) => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO orders (id, items_json, zones_json, zones_completed_json, put_wall_slot, mhe_json, status, backorder_items_json, started_at, packed_at, created_at)
      VALUES (?, ?, ?, '[]', ?, ?, ?, ?, NULL, NULL, ?)
    `).run(orderId, JSON.stringify(items), JSON.stringify(zones), putWallSlot, JSON.stringify(mhe), status, JSON.stringify(backorderItems), now);
    return OrderDAO.getById(orderId);
  },
  updateStatus: (orderId, status) => {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  },
  setStartedAtIfNull: (orderId, timestamp) => {
    db.prepare('UPDATE orders SET started_at = COALESCE(started_at, ?) WHERE id = ?').run(timestamp, orderId);
  },
  addZoneCompleted: (orderId, zone) => {
    const order = OrderDAO.getById(orderId);
    if (!order) return;
    if (!order.zonesCompleted.includes(zone)) {
      order.zonesCompleted.push(zone);
      const isReadyToPack = order.zonesCompleted.length >= order.zones.length;
      const newStatus = isReadyToPack ? 'Ready to Pack' : order.status;
      db.prepare(`
        UPDATE orders
        SET zones_completed_json = ?, status = ?
        WHERE id = ?
      `).run(JSON.stringify(order.zonesCompleted), newStatus, orderId);
    }
  },
  packOrder: (orderId, qcData = null) => {
    const order = OrderDAO.getById(orderId);
    if (!order) return null;
    const now = Date.now();
    const startedAt = order.startedAt || now;
    let leadTimeMs = now - startedAt;
    if (leadTimeMs < 0) leadTimeMs = 0;

    db.prepare(`
      UPDATE orders
      SET status = 'Packed', packed_at = ?
      WHERE id = ?
    `).run(now, orderId);

    const skuCount = Object.keys(order.items).length;
    const totalUnits = Object.values(order.items).reduce((a, b) => a + b, 0);
    const itemSummary = `${skuCount} SKU / ${totalUnits} ชิ้น`;

    db.prepare(`
      INSERT INTO packed_history (order_id, put_wall_slot, item_summary, lead_time_ms, packed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, order.putWallSlot, itemSummary, leadTimeMs, now);

    // Record QC inspection
    if (qcData) {
      QCDAO.recordInspection({
        orderId,
        inspectorName: qcData.inspectorName || 'พนักงานโต๊ะแพ็ก',
        status: qcData.status || 'PASS',
        defectType: qcData.defectType || 'NONE',
        defectNotes: qcData.defectNotes || '',
        itemsChecked: totalUnits
      });
    } else {
      const existingQc = db.prepare('SELECT id FROM qc_logs WHERE order_id = ?').get(orderId);
      if (!existingQc) {
        QCDAO.recordInspection({
          orderId,
          inspectorName: 'พนักงานโต๊ะแพ็ก',
          status: 'PASS',
          defectType: 'NONE',
          defectNotes: 'ตรวจนับผ่านพร้อมปิดกล่อง',
          itemsChecked: totalUnits
        });
      }
    }

    return { order: OrderDAO.getById(orderId), leadTimeMs, itemSummary };
  },
  fulfillBackorders: () => {
    const backorderedOrders = db.prepare("SELECT * FROM orders WHERE status = 'Backordered' ORDER BY created_at ASC").all();
    const unblockedOrders = [];

    for (const rawOrd of backorderedOrders) {
      const items = JSON.parse(rawOrd.items_json);
      let canFulfill = true;

      for (const [skuId, qtyNeeded] of Object.entries(items)) {
        const prod = db.prepare('SELECT stock FROM products WHERE id = ?').get(skuId);
        if (!prod || prod.stock < qtyNeeded) {
          canFulfill = false;
          break;
        }
      }

      if (canFulfill) {
        // Change order status to Queued and clear shortage
        db.prepare("UPDATE orders SET status = 'Queued', backorder_items_json = '{}' WHERE id = ?").run(rawOrd.id);
        unblockedOrders.push(OrderDAO.getById(rawOrd.id));
      }
    }

    return unblockedOrders;
  },
  getHistory: () => {
    return db.prepare('SELECT * FROM packed_history ORDER BY packed_at DESC').all();
  }
};

const PurchasePlanDAO = {
  getAll: () => {
    const rows = db.prepare('SELECT * FROM purchase_plans ORDER BY created_at DESC').all();
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      supplier: r.supplier,
      status: r.status,
      items: JSON.parse(r.items_json),
      totalQty: r.total_qty,
      totalCost: r.total_cost,
      etaMs: r.eta_ms,
      etaMinutes: r.eta_minutes,
      orderedAt: r.ordered_at,
      receivedAt: r.received_at,
      notes: r.notes,
      createdAt: r.created_at
    }));
  },
  getById: (id) => {
    const r = db.prepare('SELECT * FROM purchase_plans WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      supplier: r.supplier,
      status: r.status,
      items: JSON.parse(r.items_json),
      totalQty: r.total_qty,
      totalCost: r.total_cost,
      etaMs: r.eta_ms,
      etaMinutes: r.eta_minutes,
      orderedAt: r.ordered_at,
      receivedAt: r.received_at,
      notes: r.notes,
      createdAt: r.created_at
    };
  },
  create: ({ id, title, supplier, items = [], etaMinutes = 5, notes = '', status = 'Ordered' }) => {
    const planId = id || ('PO-' + Date.now().toString().slice(-6));
    const now = Date.now();
    const totalQty = items.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const totalCost = items.reduce((sum, item) => sum + ((parseFloat(item.unitPrice) || 0) * (parseInt(item.qty, 10) || 0)), 0);

    const etaMins = parseInt(etaMinutes, 10) || 5;
    const orderedAt = (status === 'Ordered') ? now : null;
    const etaMs = (status === 'Ordered') ? (now + (etaMins * 60 * 1000)) : null;

    db.prepare(`
      INSERT INTO purchase_plans (id, title, supplier, status, items_json, total_qty, total_cost, eta_ms, eta_minutes, ordered_at, received_at, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(planId, title, supplier, status, JSON.stringify(items), totalQty, totalCost, etaMs, etaMins, orderedAt, notes, now);

    return PurchasePlanDAO.getById(planId);
  },
  placeOrder: (id, etaMinutes = 5) => {
    const plan = PurchasePlanDAO.getById(id);
    if (!plan) return null;
    const now = Date.now();
    const etaMins = parseInt(etaMinutes, 10) || 5;
    const etaMs = now + (etaMins * 60 * 1000);

    db.prepare(`
      UPDATE purchase_plans
      SET status = 'Ordered', ordered_at = ?, eta_minutes = ?, eta_ms = ?
      WHERE id = ?
    `).run(now, etaMins, etaMs, id);

    return PurchasePlanDAO.getById(id);
  },
  receiveGoods: (id) => {
    const plan = PurchasePlanDAO.getById(id);
    if (!plan) return null;
    if (plan.status === 'Received') {
      return { plan, alreadyReceived: true, unblockedOrders: [], updatedProducts: [] };
    }

    const now = Date.now();
    // 1. Update purchase plan status
    db.prepare(`
      UPDATE purchase_plans
      SET status = 'Received', received_at = ?
      WHERE id = ?
    `).run(now, id);

    // 2. Add stock for each item in the plan
    const updatedProducts = [];
    for (const item of plan.items) {
      const qty = parseInt(item.qty, 10) || 0;
      if (qty > 0 && item.skuId) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(qty, item.skuId);
        const prod = ProductDAO.getById(item.skuId);
        if (prod) updatedProducts.push(prod);
      }
    }

    // 3. Fulfill backorders if any
    const unblockedOrders = OrderDAO.fulfillBackorders();

    return {
      plan: PurchasePlanDAO.getById(id),
      updatedProducts,
      unblockedOrders
    };
  },
  delete: (id) => {
    db.prepare('DELETE FROM purchase_plans WHERE id = ?').run(id);
    return true;
  },
  getSuggestions: () => {
    const products = ProductDAO.getAll();
    const backorderedOrders = db.prepare("SELECT * FROM orders WHERE status = 'Backordered'").all();

    // Calculate total backordered demand per SKU
    const backorderDemandMap = {};
    backorderedOrders.forEach(rawOrd => {
      const backorderItems = JSON.parse(rawOrd.backorder_items_json || '{}');
      for (const [skuId, shortQty] of Object.entries(backorderItems)) {
        backorderDemandMap[skuId] = (backorderDemandMap[skuId] || 0) + (parseInt(shortQty, 10) || 0);
      }
    });

    const suggestions = [];

    products.forEach(p => {
      const boDemand = backorderDemandMap[p.id] || 0;
      const isLowStock = p.stock <= 10;

      if (boDemand > 0 || isLowStock) {
        let suggestedQty = 20;
        let priority = 'MEDIUM';
        let reason = '';

        if (boDemand > 0) {
          suggestedQty = boDemand + 20;
          priority = 'CRITICAL';
          reason = `🚨 มียอดสั่งจองค้างส่ง ${boDemand} ชิ้น (สต็อกเหลือ ${p.stock})`;
        } else if (p.stock <= 5) {
          suggestedQty = Math.max(30 - p.stock, 25);
          priority = 'HIGH';
          reason = `⚠️ สต็อกเหลือน้อยมาก (${p.stock} ชิ้น)`;
        } else if (p.stock <= 10) {
          suggestedQty = Math.max(20 - p.stock, 15);
          priority = 'MEDIUM';
          reason = `🟡 ต่ำกว่าจุดสั่งซื้อ Reorder Point (${p.stock} ชิ้น)`;
        }

        suggestions.push({
          skuId: p.id,
          name: p.name,
          barcode: p.barcode,
          loc: p.loc,
          zone: p.zone,
          stock: p.stock,
          backorderDemand: boDemand,
          suggestedQty,
          unitPrice: p.price,
          image: p.image,
          priority,
          reason
        });
      }
    });

    const priorityWeight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    suggestions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return suggestions;
  }
};

const WaveDAO = {
  getAll: () => {
    const rows = db.prepare('SELECT * FROM waves WHERE completed = 0 ORDER BY created_at ASC').all();
    return rows.map(r => ({
      waveId: r.id,
      zone: r.zone,
      pickList: JSON.parse(r.pick_list_json),
      orders: JSON.parse(r.orders_json),
      completed: !!r.completed,
      createdAt: r.created_at
    }));
  },
  getById: (id) => {
    const r = db.prepare('SELECT * FROM waves WHERE id = ?').get(id);
    if (!r) return null;
    return {
      waveId: r.id,
      zone: r.zone,
      pickList: JSON.parse(r.pick_list_json),
      orders: JSON.parse(r.orders_json),
      completed: !!r.completed,
      createdAt: r.created_at
    };
  },
  saveWave: ({ waveId, zone, pickList, orders }) => {
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO waves (id, zone, pick_list_json, orders_json, completed, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(waveId, zone, JSON.stringify(pickList), JSON.stringify(orders), now);
    return WaveDAO.getById(waveId);
  },
  updatePickList: (waveId, pickList, completed) => {
    db.prepare(`
      UPDATE waves
      SET pick_list_json = ?, completed = ?
      WHERE id = ?
    `).run(JSON.stringify(pickList), completed ? 1 : 0, waveId);
  }
};

const WorkerDAO = {
  getAll: () => db.prepare('SELECT * FROM workers ORDER BY id ASC').all(),
  getById: (id) => db.prepare('SELECT * FROM workers WHERE id = ?').get(id),
  clockIn: (id, name) => {
    const worker = WorkerDAO.getById(id);
    const now = Date.now();
    if (worker) {
      if (worker.clocked_in) return { worker, alreadyIn: true };
      const updatedName = name || worker.name;
      db.prepare(`
        UPDATE workers
        SET clocked_in = 1, last_clock_in_at = ?, name = ?
        WHERE id = ?
      `).run(now, updatedName, id);
    } else {
      db.prepare(`
        INSERT INTO workers (id, name, clocked_in, total_time_ms, last_clock_in_at, units_picked, waves_completed)
        VALUES (?, ?, 1, 0, ?, 0, 0)
      `).run(id, name, now);
    }
    return { worker: WorkerDAO.getById(id), alreadyIn: false };
  },
  clockOut: (id) => {
    const worker = WorkerDAO.getById(id);
    if (!worker || !worker.clocked_in) return null;
    const now = Date.now();
    const elapsed = worker.last_clock_in_at ? (now - worker.last_clock_in_at) : 0;
    db.prepare(`
      UPDATE workers
      SET clocked_in = 0, total_time_ms = total_time_ms + ?, last_clock_in_at = NULL
      WHERE id = ?
    `).run(elapsed, id);
    return WorkerDAO.getById(id);
  },
  incrementUnitsPicked: (id) => {
    if (!id) return;
    db.prepare('UPDATE workers SET units_picked = units_picked + 1 WHERE id = ?').run(id);
  },
  incrementUnitsPickedBy: (id, qty = 1) => {
    if (!id) return;
    const amount = Math.max(1, parseInt(qty, 10) || 1);
    db.prepare('UPDATE workers SET units_picked = units_picked + ? WHERE id = ?').run(amount, id);
  }
};

const QCDAO = {
  recordInspection: ({ orderId, inspectorName, status, defectType, defectNotes, itemsChecked }) => {
    const now = Date.now();
    const finalInspector = inspectorName || 'พนักงานตรวจสอบ QC';
    const finalStatus = status === 'FAIL' ? 'FAIL' : 'PASS';
    const finalDefect = finalStatus === 'FAIL' ? (defectType || 'WRONG_SKU') : 'NONE';
    const finalNotes = defectNotes || '';
    const checked = Number(itemsChecked) || 1;

    const info = db.prepare(`
      INSERT INTO qc_logs (order_id, inspector_name, status, defect_type, defect_notes, items_checked, inspected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, finalInspector, finalStatus, finalDefect, finalNotes, checked, now);

    return {
      id: info.lastInsertRowid,
      order_id: orderId,
      inspector_name: finalInspector,
      status: finalStatus,
      defect_type: finalDefect,
      defect_notes: finalNotes,
      items_checked: checked,
      inspected_at: now
    };
  },
  updateLog: (id, { status, defectType, defectNotes, inspectorName, itemsChecked }) => {
    const existing = db.prepare('SELECT * FROM qc_logs WHERE id = ?').get(id);
    if (!existing) return null;

    const finalStatus = status === 'FAIL' ? 'FAIL' : 'PASS';
    const finalDefect = finalStatus === 'FAIL' ? (defectType || existing.defect_type || 'WRONG_SKU') : 'NONE';
    const finalNotes = defectNotes !== undefined ? defectNotes : existing.defect_notes;
    const finalInspector = inspectorName || existing.inspector_name;
    const finalItems = itemsChecked !== undefined ? Number(itemsChecked) : existing.items_checked;

    db.prepare(`
      UPDATE qc_logs
      SET status = ?, defect_type = ?, defect_notes = ?, inspector_name = ?, items_checked = ?
      WHERE id = ?
    `).run(finalStatus, finalDefect, finalNotes, finalInspector, finalItems, id);

    return db.prepare('SELECT * FROM qc_logs WHERE id = ?').get(id);
  },
  getLogs: (limit = 50) => {
    return db.prepare('SELECT * FROM qc_logs ORDER BY inspected_at DESC LIMIT ?').all(limit);
  },
  getStats: () => {
    const total = db.prepare('SELECT COUNT(*) as count FROM qc_logs').get().count;
    const passCount = db.prepare("SELECT COUNT(*) as count FROM qc_logs WHERE status = 'PASS'").get().count;
    const failCount = db.prepare("SELECT COUNT(*) as count FROM qc_logs WHERE status = 'FAIL'").get().count;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '100.0';

    const defects = db.prepare(`
      SELECT defect_type, COUNT(*) as count
      FROM qc_logs
      WHERE status = 'FAIL'
      GROUP BY defect_type
    `).all();

    const defectBreakdown = {
      WRONG_SKU: 0,
      WRONG_QTY: 0,
      DAMAGED_ITEM: 0,
      DEFECTIVE_BARCODE: 0
    };
    defects.forEach(d => {
      if (d.defect_type && d.defect_type !== 'NONE') {
        defectBreakdown[d.defect_type] = d.count;
      }
    });

    return {
      totalInspected: total,
      passCount,
      failCount,
      passRate: parseFloat(passRate),
      defectBreakdown
    };
  }
};

const LocationMoveDAO = {
  getHistory: (limit = 50) => {
    const lim = Math.max(1, parseInt(limit, 10) || 50);
    return db.prepare('SELECT * FROM location_moves ORDER BY created_at DESC LIMIT ?').all(lim);
  },
  record: ({ skuId, skuName, fromLoc, toLoc, fromZone, toZone, reason, movedBy }) => {
    const now = Date.now();
    const info = db.prepare(`
      INSERT INTO location_moves (sku_id, sku_name, from_loc, to_loc, from_zone, to_zone, reason, moved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(skuId, skuName, fromLoc, toLoc, fromZone, toZone, reason || '', movedBy || 'เจ้าหน้าที่คลัง', now);
    return {
      id: info.lastInsertRowid,
      sku_id: skuId,
      sku_name: skuName,
      from_loc: fromLoc,
      to_loc: toLoc,
      from_zone: fromZone,
      to_zone: toZone,
      reason,
      moved_by: movedBy,
      created_at: now
    };
  }
};

initDb();

module.exports = {
  db,
  ProductDAO,
  OrderDAO,
  WaveDAO,
  WorkerDAO,
  QCDAO,
  PurchasePlanDAO,
  LocationMoveDAO,
  generateEAN13
};

