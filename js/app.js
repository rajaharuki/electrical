import { createApp, ref, reactive, computed, onMounted, watch } from 
    'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

import {
    db, storage,
    ref as dbRef, push, onValue, remove, update, serverTimestamp,
    storageRef, uploadString, getDownloadURL, deleteObject,
    ensureFirebaseAuth
} from './firebase-config.js';

// ================================================================
// CONSTANTS
// ================================================================
const UAS_START = new Date('2025-07-16T00:00:00');
const UAS_END   = new Date('2025-07-22T23:59:59');
const DAYS      = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const COLORS    = ['#00f5ff','#0066ff','#7b2fff','#ff2d78','#22c55e','#f59e0b','#ec4899','#14b8a6'];

// ================================================================
// VUE APP
// ================================================================
createApp({
    setup() {

        // ── Reactive State ───────────────────────────────────────
        const loading        = ref(true);
        const loadPct        = ref(0);
        const activeNav      = ref('home');
        const mobileOpen     = ref(false);
        const darkMode       = ref(true);

        // Data from Firebase
        const schedules      = ref([]);
        const uasList        = ref([]);
        const tasks          = ref([]);
        const memories       = ref([]);
        const announcements  = ref([]);

        // Modals
        const modals = reactive({
            fab:      false,
            schedule: false,
            uas:      false,
            task:     false,
            memory:   false,
            ann:      false,
            edit:     false,
        });

        // Forms
        const schedForm = reactive({
            course:'', day:'', start:'', end:'',
            room:'', lecturer:'', sks:'', color:'#00f5ff', note:''
        });
        const uasForm = reactive({
            course:'', date:'', start:'', end:'', room:'', note:''
        });
        const taskForm = reactive({
            title:'', course:'', desc:'', deadline:'', priority:'medium'
        });
        const memForm = reactive({
            caption:'', date: new Date().toISOString().split('T')[0],
            files: []
        });
        const annForm = reactive({
            text:'', tag:'URGENT', until:''
        });

        // Misc UI state
        const schedView    = ref('week');  // 'week' | 'list'
        const taskFilter   = ref('all');
        const previewUrls  = ref([]);
        const countdown    = reactive({ d:'00', h:'00', m:'00', s:'00' });
        const lbOpen       = ref(false);
        const lbIndex      = ref(0);
        const toasts       = ref([]);
        const dragOver     = ref(false);
        const onlineCount  = ref(1);

        // Edit state
        const editTarget = reactive({ type:'', data:{} });

        // ── Computed ─────────────────────────────────────────────
        const uasState = computed(() => {
            const now = new Date();
            if(now < UAS_START) return 'before';
            if(now > UAS_END)   return 'after';
            return 'during';
        });

        const activeAnnouncements = computed(() =>
            announcements.value.filter(a => !a.until || new Date(a.until) > new Date())
        );

        const schedulesByDay = computed(() => {
            const map = {};
            DAYS.forEach(d => map[d] = []);
            schedules.value.forEach(s => {
                if(map[s.day]) map[s.day].push(s);
            });
            DAYS.forEach(d => map[d].sort((a,b) => a.start.localeCompare(b.start)));
            return map;
        });

        const filteredTasks = computed(() => {
            let t = [...tasks.value];
            if(taskFilter.value === 'done')    t = t.filter(x => x.done);
            if(taskFilter.value === 'pending') t = t.filter(x => !x.done);
            if(['high','medium','low'].includes(taskFilter.value))
                t = t.filter(x => x.priority === taskFilter.value);
            return t.sort((a,b) => {
                if(a.done !== b.done) return a.done ? 1 : -1;
                const p = {high:0,medium:1,low:2};
                return p[a.priority] - p[b.priority];
            });
        });

        const sortedUAS = computed(() =>
            [...uasList.value].sort((a,b) =>
                a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
            )
        );

        const pendingTaskCount = computed(() =>
            tasks.value.filter(t => !t.done).length
        );

        const uniqueCourseCount = computed(() =>
            new Set(schedules.value.map(s => s.course)).size
        );

        const uasNavBadge = computed(() => {
            if(uasState.value === 'before') return { text:'SOON',  color:'#ff2d78' };
            if(uasState.value === 'during') return { text:'LIVE',  color:'#22c55e' };
            return                                 { text:'DONE',  color:'#0066ff' };
        });

        const isUasSoon = computed(() => {
            const diff = UAS_START - new Date();
            return diff > 0 && diff < 86400000 * 3; // within 3 days
        });

        // ── Firebase Listeners ───────────────────────────────────
        function bindFirebase() {
            const keys = ['schedules','uas','tasks','memories','announcements'];
            const targets = { schedules, uas: uasList, tasks, memories, announcements };
            
            keys.forEach(key => {
                onValue(dbRef(db, key), snap => {
                    const val = snap.val();
                    const arr = val
                        ? Object.entries(val).map(([id, data]) => ({ id, ...data }))
                        : [];
                    targets[key].value = arr;
                });
            });
        }

        // ── CRUD: Schedule ────────────────────────────────────────
        async function addSchedule() {
            if(!schedForm.course || !schedForm.day || !schedForm.start || !schedForm.end) {
                showToast('Lengkapi form dulu ya!', 'error'); return;
            }
            await push(dbRef(db, 'schedules'), {
                ...schedForm,
                createdAt: serverTimestamp()
            });
            resetForm(schedForm, { course:'',day:'',start:'',end:'',room:'',lecturer:'',sks:'',color:'#00f5ff',note:'' });
            modals.schedule = false;
            showToast('Jadwal berhasil ditambahkan! ⚡');
        }

        async function deleteSchedule(id) {
            if(!confirm('Hapus jadwal ini?')) return;
            await remove(dbRef(db, `schedules/${id}`));
            showToast('Jadwal dihapus.', 'error');
        }

        // ── CRUD: UAS ─────────────────────────────────────────────
        async function addUAS() {
            if(uasState.value === 'after') {
                showToast('UAS sudah selesai, jadwal terkunci.', 'error'); return;
            }
            if(!uasForm.course || !uasForm.date) {
                showToast('Lengkapi form dulu!', 'error'); return;
            }
            const d = new Date(uasForm.date);
            if(d < UAS_START || d > UAS_END) {
                showToast('Tanggal harus 16–22 Juli 2025.', 'error'); return;
            }
            await push(dbRef(db, 'uas'), {
                ...uasForm,
                createdAt: serverTimestamp()
            });
            resetForm(uasForm, { course:'',date:'',start:'',end:'',room:'',note:'' });
            modals.uas = false;
            showToast('Jadwal UAS ditambahkan! 📝');
        }

        async function deleteUAS(id) {
            if(uasState.value === 'after') {
                showToast('Jadwal terkunci setelah UAS selesai.', 'error'); return;
            }
            if(!confirm('Hapus jadwal UAS ini?')) return;
            await remove(dbRef(db, `uas/${id}`));
            showToast('Jadwal UAS dihapus.', 'error');
        }

        // ── CRUD: Tasks ───────────────────────────────────────────
        async function addTask() {
            if(!taskForm.title) {
                showToast('Judul tugas wajib diisi!', 'error'); return;
            }
            await push(dbRef(db, 'tasks'), {
                ...taskForm,
                done: false,
                createdAt: serverTimestamp()
            });
            resetForm(taskForm, { title:'',course:'',desc:'',deadline:'',priority:'medium' });
            modals.task = false;
            showToast('Tugas ditambahkan! ✅');
        }

        async function toggleTask(task) {
            await update(dbRef(db, `tasks/${task.id}`), { done: !task.done });
        }

        async function deleteTask(id) {
            if(!confirm('Hapus tugas ini?')) return;
            await remove(dbRef(db, `tasks/${id}`));
            showToast('Tugas dihapus.', 'error');
        }

        // ── CRUD: Memories ────────────────────────────────────────
        async function addMemory() {
            if(!memForm.files.length) {
                showToast('Pilih foto dulu!', 'error'); return;
            }
            await ensureFirebaseAuth();
            showToast('Uploading foto...', 'info');
            let uploaded = 0;
            let failed = 0;
            
            for(const file of memForm.files) {
                const reader = new FileReader();
                await new Promise(resolve => {
                    reader.onload = async e => {
                        try {
                            // Upload to Firebase Storage
                            const path = `memories/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
                            const sRef = storageRef(storage, path);
                            await uploadString(sRef, e.target.result, 'data_url');
                            const url = await getDownloadURL(sRef);

                            // Save to Realtime DB
                            await push(dbRef(db, 'memories'), {
                                url,
                                path,
                                caption: memForm.caption || file.name,
                                date:    memForm.date || new Date().toISOString().split('T')[0],
                                createdAt: serverTimestamp()
                            });
                            uploaded++;
                        } catch(err) {
                            console.error('Upload error:', err);
                            failed++;
                            const msg = err && err.message ? err.message : String(err);
                            // Try fallback: save base64 to Realtime DB if available
                            try {
                                if(db && push && dbRef) {
                                    await push(dbRef(db, 'memories'), {
                                        url: e.target.result,
                                        caption: memForm.caption || file.name,
                                        date: memForm.date || new Date().toISOString().split('T')[0],
                                        fallback: true,
                                        createdAt: serverTimestamp()
                                    });
                                    showToast(`Upload gagal (${msg}). Foto disimpan ke Realtime DB sebagai fallback.`, 'info');
                                } else {
                                    showToast(`Upload gagal: ${msg}`,'error');
                                }
                            } catch(fbErr) {
                                console.error('Fallback DB save error:', fbErr);
                                showToast(`Upload gagal dan fallback gagal: ${msg}`,'error');
                            }
                        }
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }

            memForm.files   = [];
            memForm.caption = '';
            previewUrls.value = [];
            modals.memory = false;
            if(failed) {
                showToast(`${uploaded} foto berhasil diupload, ${failed} gagal. Cek izin Firebase Storage.`, 'error');
            } else {
                showToast(`${uploaded} foto berhasil diupload! 📸`);
            }
        }

        async function deleteMemory(mem) {
            if(!confirm('Hapus foto ini?')) return;
            try {
                if(mem.path) await deleteObject(storageRef(storage, mem.path));
            } catch(e) { /* file mungkin udah ga ada */ }
            await remove(dbRef(db, `memories/${mem.id}`));
            showToast('Foto dihapus.', 'error');
        }

        // ── CRUD: Announcements ────────────────────────────────────
        async function addAnn() {
            if(!annForm.text.trim()) {
                showToast('Isi pengumuman dulu!', 'error'); return;
            }
            await push(dbRef(db, 'announcements'), {
                ...annForm,
                createdAt: serverTimestamp()
            });
            resetForm(annForm, { text:'', tag:'URGENT', until:'' });
            modals.ann = false;
            showToast('Pengumuman ditambahkan! 📢');
        }

        async function deleteAnn(id) {
            await remove(dbRef(db, `announcements/${id}`));
            showToast('Pengumuman dihapus.', 'error');
        }

        // ── File Handling ─────────────────────────────────────────
        function handleFiles(files) {
            memForm.files = Array.from(files);
            previewUrls.value = [];
            memForm.files.forEach(f => {
                const reader = new FileReader();
                reader.onload = e => previewUrls.value.push(e.target.result);
                reader.readAsDataURL(f);
            });
        }

        function onFilePick(e) { handleFiles(e.target.files); }

        function onDrop(e) {
            dragOver.value = false;
            handleFiles(e.dataTransfer.files);
        }

        // ── Lightbox ──────────────────────────────────────────────
        function openLightbox(idx) { lbIndex.value = idx; lbOpen.value = true; }
        function closeLightbox()   { lbOpen.value = false; }
        function lbNav(dir) {
            lbIndex.value = (lbIndex.value + dir + memories.value.length) % memories.value.length;
        }

        // ── Toast ─────────────────────────────────────────────────
        function showToast(msg, type='success') {
            const id = Date.now();
            toasts.value.push({ id, msg, type });
            setTimeout(() => {
                toasts.value = toasts.value.filter(t => t.id !== id);
            }, 3500);
        }

        // ── Countdown ─────────────────────────────────────────────
        function tickCountdown() {
            const diff = UAS_START - new Date();
            if(diff <= 0) return;
            countdown.d = String(Math.floor(diff / 86400000)).padStart(2,'0');
            countdown.h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2,'0');
            countdown.m = String(Math.floor((diff % 3600000)  / 60000)).padStart(2,'0');
            countdown.s = String(Math.floor((diff % 60000)    / 1000)).padStart(2,'0');
        }

        // ── Helpers ───────────────────────────────────────────────
        function resetForm(form, defaults) {
            Object.assign(form, defaults);
        }

        function formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString('id', {
                day:'numeric', month:'long', year:'numeric'
            });
        }

        function isDeadlineSoon(dl) {
            if(!dl) return false;
            const diff = new Date(dl) - new Date();
            return diff > 0 && diff < 86400000 * 2;
        }

        function isUASToday(dateStr) {
            return new Date().toDateString() === new Date(dateStr).toDateString();
        }

        function getUASDay(dateStr) {
            return new Date(dateStr).getDate();
        }

        function getUASMonth(dateStr) {
            return new Date(dateStr).toLocaleString('id', { month:'short' });
        }

        function closeAllModals() {
            Object.keys(modals).forEach(k => modals[k] = false);
        }

        function openFab(type) {
            modals.fab = false;
            modals[type] = true;
        }

        function scrollTo(section) {
            document.getElementById(section)?.scrollIntoView({ behavior:'smooth' });
            activeNav.value = section;
            mobileOpen.value = false;
        }

        // ── Scroll spy ────────────────────────────────────────────
        function initScrollSpy() {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if(e.isIntersecting) activeNav.value = e.target.id;
                });
            }, { threshold: 0.3 });

            ['home','schedule','uas','tasks','memories','announcements']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if(el) obs.observe(el);
                });
        }

        // ── Reveal on scroll ──────────────────────────────────────
        function initReveal() {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if(e.isIntersecting) e.target.classList.add('visible');
                });
            }, { threshold: 0.1 });

            document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
        }

        // ── Three.js PCB Scene ────────────────────────────────────
        function initThreeJS() {
            const canvas = document.getElementById('hero-canvas');
            if(!canvas || !window.THREE) return;

            const THREE = window.THREE;
            const W = canvas.offsetWidth;
            const H = canvas.offsetHeight;

            const renderer = new THREE.WebGLRenderer({ 
                canvas, antialias: true, alpha: true 
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            renderer.setSize(W, H);
            renderer.setClearColor(0x000000, 0);

            const scene  = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W/H, 0.1, 100);
            camera.position.set(0, 2.5, 9);
            camera.lookAt(0, 0, 0);

            // Lights
            scene.add(new THREE.AmbientLight(0x002244, 3));

            const dLight = new THREE.DirectionalLight(0x00f5ff, 2.5);
            dLight.position.set(5, 10, 5);
            scene.add(dLight);

            const pLight1 = new THREE.PointLight(0x00f5ff, 4, 18);
            pLight1.position.set(-4, 3, 3);
            scene.add(pLight1);

            const pLight2 = new THREE.PointLight(0x7b2fff, 3, 15);
            pLight2.position.set(4, -2, 2);
            scene.add(pLight2);

            const pLight3 = new THREE.PointLight(0x0066ff, 2, 12);
            pLight3.position.set(0, 5, -3);
            scene.add(pLight3);

            // ── PCB Board ──
            const boardGeo = new THREE.BoxGeometry(13, 0.1, 9);
            const boardMat = new THREE.MeshPhongMaterial({
                color:    0x001a0d,
                emissive: 0x000d06,
                specular: 0x00ff88,
                shininess: 60
            });
            const board = new THREE.Mesh(boardGeo, boardMat);
            board.rotation.x = -0.35;
            scene.add(board);

            // ── Gold traces ──
            const goldMat  = new THREE.MeshBasicMaterial({ color: 0xd4a843, transparent:true, opacity:0.7 });
            const traceMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent:true, opacity:0.5 });

            function makeTrace(x1,z1,x2,z2,mat,thickness=0.025) {
                const len = Math.sqrt((x2-x1)**2+(z2-z1)**2);
                const geo = new THREE.BoxGeometry(thickness, 0.005, len);
                const m   = new THREE.Mesh(geo, mat);
                m.position.set((x1+x2)/2, 0.06, (z1+z2)/2);
                m.rotation.y = Math.atan2(x2-x1, z2-z1);
                board.add(m);
            }

            // Horizontal traces
            for(let z=-3.5; z<=3.5; z+=1.2) makeTrace(-6,z,6,z,traceMat);
            // Vertical traces
            for(let x=-5; x<=5; x+=1.5)     makeTrace(x,-4,x,4,goldMat);
            // Diagonal
            makeTrace(-5,-3.5,5,3.5,traceMat,0.02);
            makeTrace(-5,3.5,5,-3.5,traceMat,0.02);

            // ── Via holes (pads) ──
            const viaMat = new THREE.MeshBasicMaterial({ color: 0xd4a843 });
            const viaGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8);
            for(let x=-4.5; x<=4.5; x+=1.5) {
                for(let z=-3; z<=3; z+=1.2) {
                    const via = new THREE.Mesh(viaGeo, viaMat.clone());
                    via.position.set(x, 0.07, z);
                    board.add(via);
                }
            }

            // ── ICs / Chips ──
            const chips   = [];
            const chipMat = new THREE.MeshPhongMaterial({
                color:0x0a0a1a, emissive:0x000011, specular:0x333366, shininess:100
            });
            const legMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess:200 });

            const chipDefs = [
                { x:-2.5, z:-1.5, w:1.2, d:0.9 },
                { x: 1.0, z:-0.8, w:1.5, d:1.1 },
                { x:-0.5, z: 1.5, w:0.9, d:0.9 },
                { x: 3.0, z: 1.0, w:1.2, d:0.8 },
                { x:-3.5, z: 1.2, w:0.8, d:0.8 },
                { x: 0.5, z:-2.2, w:1.0, d:0.7 },
                { x: 2.5, z:-2.0, w:0.7, d:0.7 },
            ];

            chipDefs.forEach(def => {
                const cg  = new THREE.BoxGeometry(def.w, 0.18, def.d);
                const chip = new THREE.Mesh(cg, chipMat.clone());
                chip.position.set(def.x, 0.14, def.z);
                board.add(chip);
                chips.push(chip);

                // Pin legs
                const legCount = Math.floor(def.w / 0.18);
                for(let i=0; i<legCount; i++) {
                    const lx = -def.w/2 + (i+0.5)*(def.w/legCount);
                    [-1,1].forEach(side => {
                        const leg = new THREE.Mesh(
                            new THREE.BoxGeometry(0.04, 0.04, 0.18),
                            legMat
                        );
                        leg.position.set(lx, -0.08, side*(def.d/2+0.09));
                        chip.add(leg);
                    });
                }

                // Chip mark (dot)
                const dotG = new THREE.CircleGeometry(0.06, 8);
                const dotM = new THREE.MeshBasicMaterial({ color:0x00f5ff });
                const dot  = new THREE.Mesh(dotG, dotM);
                dot.rotation.x = -Math.PI/2;
                dot.position.set(-def.w/2+0.15, 0.1, -def.d/2+0.15);
                chip.add(dot);
            });

            // ── Capacitors ──
            const capMat = new THREE.MeshPhongMaterial({
                color:0x223399, emissive:0x001133, shininess:80
            });
            const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10);
            [[2.2,0.2,1.8],[-1.2,0.2,-0.9],[3.5,0.2,-1.5],[-2,0.2,1.0]].forEach(([x,y,z]) => {
                const cap = new THREE.Mesh(capGeo, capMat.clone());
                cap.position.set(x, y, z);
                board.add(cap);
            });

            // ── Resistors ──
            const resMat = new THREE.MeshPhongMaterial({ color:0x8B4513, shininess:40 });
            const resGeo = new THREE.BoxGeometry(0.35, 0.1, 0.15);
            [[-3.5,-1.5],[-1.5,2.2],[4.0,-0.5],[1.5,2.5]].forEach(([x,z]) => {
                const res = new THREE.Mesh(resGeo, resMat.clone());
                res.position.set(x, 0.11, z);
                board.add(res);
            });

            // ── Glowing electrons (particles) ──
            const electrons = [];
            const eMats = [
                new THREE.MeshBasicMaterial({ color:0x00f5ff, transparent:true }),
                new THREE.MeshBasicMaterial({ color:0x7b2fff, transparent:true }),
                new THREE.MeshBasicMaterial({ color:0x0066ff, transparent:true }),
            ];
            const eGeo = new THREE.SphereGeometry(0.035, 6, 6);
            for(let i=0; i<20; i++) {
                const e = new THREE.Mesh(eGeo, eMats[i%3].clone());
                e.position.set(
                    (Math.random()-0.5)*14,
                    Math.random()*4+0.3,
                    (Math.random()-0.5)*9
                );
                e.userData = {
                    vx:   (Math.random()-0.5)*0.025,
                    vy:   (Math.random()-0.5)*0.010,
                    vz:   (Math.random()-0.5)*0.025,
                    phase: Math.random()*Math.PI*2
                };
                scene.add(e);
                electrons.push(e);
            }

            // ── Grid ──
            const grid = new THREE.GridHelper(40, 40, 0x001133, 0x000d22);
            grid.position.y = -2;
            scene.add(grid);

            // ── Resize ──
            new ResizeObserver(() => {
                const w = canvas.offsetWidth, h = canvas.offsetHeight;
                if(!w || !h) return;
                renderer.setSize(w, h);
                camera.aspect = w/h;
                camera.updateProjectionMatrix();
            }).observe(canvas);

            // ── Mouse parallax ──
            let mouseX = 0, mouseY = 0;
            document.addEventListener('mousemove', e => {
                mouseX = (e.clientX/window.innerWidth  - 0.5) * 2;
                mouseY = (e.clientY/window.innerHeight - 0.5) * 2;
            });

            // ── Scroll parallax ──
            let scrollY = 0;
            window.addEventListener('scroll', () => scrollY = window.scrollY);

            // ── Visible check (perf) ──
            let heroVisible = true;
            new IntersectionObserver(([e]) => heroVisible = e.isIntersecting)
                .observe(document.getElementById('home') || canvas);

            // ── Animation loop ──
            let frame = 0;
            (function loop() {
                requestAnimationFrame(loop);
                if(!heroVisible) return;
                frame++;

                // Board animation
                board.position.y   = Math.sin(frame*0.008)*0.12 - 0.15;
                board.rotation.y   = Math.sin(frame*0.005)*0.06 + mouseX*0.06;
                board.rotation.x   = -0.35 + Math.sin(frame*0.006)*0.025 + mouseY*0.025;

                // Scroll-based camera (NO heavy model swaps — just position)
                const ratio = scrollY / (window.innerHeight || 1);
                camera.position.y  = 2.5 - ratio * 1.2;
                camera.position.z  = 9   + ratio * 1.8;
                camera.lookAt(0, 0, 0);

                // Electrons
                electrons.forEach((e, i) => {
                    e.position.x += e.userData.vx;
                    e.position.y += e.userData.vy;
                    e.position.z += e.userData.vz;

                    if(Math.abs(e.position.x) > 7) e.userData.vx *= -1;
                    if(e.position.y > 5 || e.position.y < 0.2) e.userData.vy *= -1;
                    if(Math.abs(e.position.z) > 5) e.userData.vz *= -1;

                    const t = frame*0.03 + e.userData.phase;
                    e.material.opacity = 0.3 + 0.7*Math.abs(Math.sin(t));
                    const s = 0.8 + 0.4*Math.abs(Math.sin(t*0.7));
                    e.scale.setScalar(s);
                });

                // Chips glow pulse
                chips.forEach((c,i) => {
                    const t = frame*0.018 + i*0.8;
                    const b = 0.02 + 0.06*Math.abs(Math.sin(t));
                    c.material.emissive.setRGB(0, b*0.3, b);
                });

                // Lights pulse
                pLight1.intensity = 3.5 + Math.sin(frame*0.025)*1.2;
                pLight2.intensity = 2.5 + Math.cos(frame*0.020)*0.8;
                pLight3.intensity = 1.8 + Math.sin(frame*0.030)*0.6;

                renderer.render(scene, camera);
            })();
        }

        // ── OnMounted ────────────────────────────────────────────
        onMounted(() => {
            // Loader animation
            const iv = setInterval(() => {
                loadPct.value = Math.min(loadPct.value + Math.random()*15, 95);
            }, 100);

            // Bind Firebase
            bindFirebase();

            // Wait for DOM + Firebase
            setTimeout(() => {
                clearInterval(iv);
                loadPct.value = 100;
                setTimeout(() => {
                    loading.value = false;
                    // Init after loader gone
                    setTimeout(() => {
                        initThreeJS();
                        initScrollSpy();
                        initReveal();
                    }, 200);
                }, 400);
            }, 2200);

            // Countdown
            tickCountdown();
            setInterval(tickCountdown, 1000);

            // Online sim
            setInterval(() => {
                onlineCount.value = Math.floor(Math.random()*4)+1;
            }, 9000);

            // Keyboard
            window.addEventListener('keydown', e => {
                if(e.key === 'Escape') closeAllModals();
                if(lbOpen.value) {
                    if(e.key === 'ArrowLeft')  lbNav(-1);
                    if(e.key === 'ArrowRight') lbNav(1);
                }
            });
        });

        // ── Return everything to template ────────────────────────
        return {
            // State
            loading, loadPct, activeNav, mobileOpen,
            modals, schedForm, uasForm, taskForm, memForm, annForm,
            schedView, taskFilter, previewUrls, countdown,
            lbOpen, lbIndex, toasts, dragOver, onlineCount,
            // Data
            schedules, uasList, tasks, memories, announcements,
            // Computed
            uasState, activeAnnouncements, schedulesByDay,
            filteredTasks, sortedUAS, pendingTaskCount,
            uniqueCourseCount, uasNavBadge, isUasSoon,
            // Constants
            DAYS, COLORS,
            // Methods
            addSchedule, deleteSchedule,
            addUAS, deleteUAS,
            addTask, toggleTask, deleteTask,
            addMemory, deleteMemory,
            addAnn, deleteAnn,
            openFab, closeAllModals,
            openLightbox, closeLightbox, lbNav,
            onFilePick, onDrop,
            scrollTo, formatDate, isDeadlineSoon,
            isUASToday, getUASDay, getUASMonth,
            showToast,
        };
    }
}).mount('#app');