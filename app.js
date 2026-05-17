const App = {
    allData: [],
    currentView: 'home',
    currentAlbumId: null,
    currentSongId: null,
    scrollPositions: {},
    currentTag: 'all',
    searchQuery: '',
    homeScrollY: 0,
    
    audio: null,
    audioContext: null,
    sourceNodes: [],
    isIntroLoopMode: false,
    introAudioBuffer: null,
    loopAudioBuffer: null,
    gainNode: null,
    introLoopStartTime: 0,
    introLoopDuration: 0,
    previousVolume: 80,
    isPlaying: false,
    
    playMode: 'list',
    playModes: ['list', 'single', 'all', 'shuffle_list', 'shuffle_all'],
    playModeTexts: {
        'list': '列表循环',
        'single': '单曲循环',
        'all': '全部循环',
        'shuffle_list': '列表随机',
        'shuffle_all': '全局随机'
    },
    playModeIcons: {
        'list': '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>',
        'single': '<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>',
        'all': '<path d="M12 4V1L8 5l4 4V6c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8H2c0 5.52 4.48 10 10 10s10-4.48 10-10-4.48-10-10-10z"/>',
        'shuffle_list': '<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>',
        'shuffle_all': '<path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>'
    }
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
        return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    }
    return dateStr;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    return new Date(dateStr);
}

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getAllTags(data) {
    const tagSet = new Set();
    data.forEach(album => {
        if (album.tags && Array.isArray(album.tags)) {
            album.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}

function detectPlayMode(src) {
    const filename = src.split('/').pop();
    const baseName = filename.replace('.mp3', '');
    const introMatch = baseName.match(/^(.+)_intro$/);
    const loopMatch = baseName.match(/^(.+)_loop$/);
    if (introMatch) return { type: 'intro_loop', baseName: introMatch[1] };
    if (loopMatch) return { type: 'intro_loop', baseName: loopMatch[1] };
    return { type: 'single' };
}

function getFullPath(src) {
    if (src.startsWith('/')) return src;
    return `/${src}`;
}

async function loadAudio(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (!App.audioContext) {
        App.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return await App.audioContext.decodeAudioData(arrayBuffer);
}

function stopAll() {
    App.sourceNodes.forEach(s => { try { s.stop(); } catch(e) {} });
    App.sourceNodes = [];
    App.isIntroLoopMode = false;
    updatePlayState(false);
}

function updatePlayState(playing) {
    App.isPlaying = playing;
    const vinyl = document.getElementById('vinyl');
    const miniVinyl = document.getElementById('miniVinyl');
    const playIcon = document.getElementById('playIcon');
    const miniPlayIcon = document.getElementById('miniPlayIcon');
    const simplePlayIcon = document.getElementById('simplePlayIcon');
    
    if (playing) {
        vinyl.style.animationPlayState = 'running';
        miniVinyl.style.animationPlayState = 'running';
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        miniPlayIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        simplePlayIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    } else {
        vinyl.style.animationPlayState = 'paused';
        miniVinyl.style.animationPlayState = 'paused';
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        miniPlayIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        simplePlayIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
}

function playIntro() {
    if (App.introAudioBuffer && App.audioContext) {
        if (App.audioContext.state === 'suspended') {
            App.audioContext.resume().catch(() => {});
        }
        if (!App.gainNode) {
            App.gainNode = App.audioContext.createGain();
            App.gainNode.connect(App.audioContext.destination);
            App.gainNode.gain.value = document.getElementById('volumeSlider').value / 100;
        }
        
        const source = App.audioContext.createBufferSource();
        source.buffer = App.introAudioBuffer;
        source.connect(App.gainNode);
        source.start(0);
        App.sourceNodes.push(source);
        App.introLoopStartTime = App.audioContext.currentTime;
        
        source.onended = () => {
            const index = App.sourceNodes.indexOf(source);
            if (index > -1) App.sourceNodes.splice(index, 1);
            if (App.isIntroLoopMode) playLoop();
        };
        
        updatePlayState(true);
        updateIntroLoopProgress();
    }
}

function playLoop() {
    if (App.loopAudioBuffer && App.isIntroLoopMode && App.audioContext) {
        const source = App.audioContext.createBufferSource();
        source.buffer = App.loopAudioBuffer;
        source.loop = true;
        source.connect(App.gainNode);
        source.start(0);
        App.sourceNodes.push(source);
    }
}

function updateIntroLoopProgress() {
    if (!App.isIntroLoopMode || !App.audioContext) return;
    const elapsed = App.audioContext.currentTime - App.introLoopStartTime;
    const progress = Math.min((elapsed / App.introLoopDuration) * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('miniProgressFill').style.width = `${progress}%`;
    document.getElementById('currentTime').textContent = formatTime(elapsed);
    document.getElementById('miniCurrentTime').textContent = formatTime(elapsed);
    if (App.isIntroLoopMode && App.sourceNodes.length > 0) {
        requestAnimationFrame(updateIntroLoopProgress);
    }
}

async function playIntroLoop(baseName) {
    App.isIntroLoopMode = true;
    const introSrc = getFullPath(`追击音乐/欢乐惊魂/${baseName}_intro.mp3`);
    const loopSrc = introSrc.replace('_intro.mp3', '_loop.mp3');
    
    try {
        App.introAudioBuffer = await loadAudio(introSrc);
        App.loopAudioBuffer = await loadAudio(loopSrc);
        App.introLoopDuration = App.introAudioBuffer.duration + App.loopAudioBuffer.duration;
        document.getElementById('duration').textContent = formatTime(App.introLoopDuration);
        document.getElementById('miniDuration').textContent = formatTime(App.introLoopDuration);
        
        const badge = document.getElementById('playModeBadge');
        badge.textContent = 'Intro → Loop 循环';
        badge.style.display = 'inline-block';
        
        playIntro();
    } catch (e) {
        console.error('Failed to load intro/loop:', e);
    }
}

async function playSong(songId, albumId) {
    const album = App.allData.find(a => a.id === albumId);
    if (!album) return;
    const song = album.songs.find(s => s.id === songId);
    if (!song) return;
    
    stopAll();
    if (!App.audioContext || App.audioContext.state === 'closed') {
        App.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    App.currentSongId = songId;
    App.currentAlbumId = albumId;
    
    document.getElementById('playerTitle').textContent = song.title;
    document.getElementById('playerArtist').textContent = song.artist;
    document.getElementById('miniTitle').textContent = song.title;
    document.getElementById('miniArtist').textContent = song.artist;
    
    document.getElementById('downloadBtn').href = song.src;
    document.getElementById('downloadBtn').download = song.title + '.mp3';
    
    document.querySelectorAll('.song-row').forEach(r => r.classList.remove('playing'));
    const playingRow = document.querySelector(`[data-song-id="${songId}"]`);
    if (playingRow) playingRow.classList.add('playing');
    
    if (App.currentView !== 'player' && App.currentView !== 'simpleplay') {
        document.getElementById('miniPlayer').style.display = 'flex';
    }
    document.getElementById('playModeBadge').style.display = 'none';
    
    const playMode = detectPlayMode(song.src);
    if (playMode.type === 'intro_loop') {
        playIntroLoop(playMode.baseName);
    } else {
        App.audio.src = song.src;
        App.audio.play().catch(() => {});
    }
}

function togglePlay() {
    if (App.isIntroLoopMode) {
        if (App.audioContext && App.audioContext.state === 'suspended') {
            App.audioContext.resume().catch(() => {});
        }
        if (!App.sourceNodes.length) {
            playIntro();
        } else {
            stopAll();
        }
    } else {
        if (App.audio.paused) {
            App.audio.play().catch(() => {});
        } else {
            App.audio.pause();
        }
    }
}

function prevSong() {
    if (!App.currentAlbumId) return;
    const album = App.allData.find(a => a.id === App.currentAlbumId);
    if (!album || !album.songs.length) return;
    
    const currentIndex = album.songs.findIndex(s => s.id === App.currentSongId);
    let prevIndex;
    let prevAlbumId = App.currentAlbumId;
    
    if (App.playMode === 'shuffle_list') {
        prevIndex = Math.floor(Math.random() * album.songs.length);
    } else if (App.playMode === 'shuffle_all') {
        const randomAlbumIndex = Math.floor(Math.random() * App.allData.length);
        prevAlbumId = App.allData[randomAlbumIndex].id;
        const randomAlbum = App.allData.find(a => a.id === prevAlbumId);
        prevIndex = Math.floor(Math.random() * randomAlbum.songs.length);
    } else {
        prevIndex = currentIndex <= 0 ? album.songs.length - 1 : currentIndex - 1;
    }
    
    const prevAlbum = App.allData.find(a => a.id === prevAlbumId);
    playSong(prevAlbum.songs[prevIndex].id, prevAlbumId);
}

function nextSong() {
    if (!App.currentAlbumId) return;
    const album = App.allData.find(a => a.id === App.currentAlbumId);
    if (!album || !album.songs.length) return;
    
    const currentIndex = album.songs.findIndex(s => s.id === App.currentSongId);
    let nextIndex;
    let nextAlbumId = App.currentAlbumId;
    
    if (App.playMode === 'shuffle_list') {
        nextIndex = Math.floor(Math.random() * album.songs.length);
    } else if (App.playMode === 'shuffle_all') {
        const randomAlbumIndex = Math.floor(Math.random() * App.allData.length);
        nextAlbumId = App.allData[randomAlbumIndex].id;
        const randomAlbum = App.allData.find(a => a.id === nextAlbumId);
        nextIndex = Math.floor(Math.random() * randomAlbum.songs.length);
    } else if (App.playMode === 'all' && currentIndex >= album.songs.length - 1) {
        const albumIndex = App.allData.findIndex(a => a.id === App.currentAlbumId);
        const nextAlbumIndex = (albumIndex + 1) % App.allData.length;
        nextAlbumId = App.allData[nextAlbumIndex].id;
        nextIndex = 0;
    } else {
        nextIndex = currentIndex >= album.songs.length - 1 ? 0 : currentIndex + 1;
    }
    
    const nextAlbum = App.allData.find(a => a.id === nextAlbumId);
    playSong(nextAlbum.songs[nextIndex].id, nextAlbumId);
}

function togglePlayMode() {
    const currentIndex = App.playModes.indexOf(App.playMode);
    const nextIndex = (currentIndex + 1) % App.playModes.length;
    App.playMode = App.playModes[nextIndex];
    
    document.getElementById('playModeText').textContent = App.playModeTexts[App.playMode];
    document.getElementById('playModeIcon').innerHTML = App.playModeIcons[App.playMode];
}

function changeVolume(value) {
    const vol = value / 100;
    App.audio.volume = vol;
    if (App.gainNode) App.gainNode.gain.value = vol;
    document.getElementById('volumeValue').textContent = `${value}%`;
    document.getElementById('miniVolumeSlider').value = value;
    document.getElementById('volumeSlider').value = value;
    
    const volumeIcon = document.getElementById('volumeIcon');
    const miniVolumeIcon = document.getElementById('miniVolumeIcon');
    let icon = '🔊';
    if (value == 0) icon = '🔇';
    else if (value < 30) icon = '🔈';
    else if (value < 70) icon = '🔉';
    volumeIcon.textContent = icon;
    miniVolumeIcon.textContent = icon;
}

function toggleMute() {
    const slider = document.getElementById('volumeSlider');
    if (slider.value > 0) {
        App.previousVolume = slider.value;
        changeVolume(0);
    } else {
        changeVolume(App.previousVolume);
    }
}

function navigateTo(view, params = {}) {
    if (App.currentView === 'home') {
        const key = `home_${App.currentTag}`;
        App.scrollPositions[key] = window.scrollY;
    } else {
        App.scrollPositions[App.currentView] = window.scrollY;
    }
    
    App.currentView = view;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    
    const backLink = document.getElementById('backLink');
    const headerTitle = document.getElementById('headerTitle');
    const headerSubtitle = document.getElementById('headerSubtitle');
    const miniPlayer = document.getElementById('miniPlayer');
    const header = document.querySelector('header');
    
    if (view === 'home') {
        header.style.display = 'block';
        backLink.style.display = 'none';
        headerTitle.textContent = 'BWIKI 音乐资料库';
        headerSubtitle.style.display = 'block';
        miniPlayer.style.display = App.isPlaying ? 'flex' : 'none';
        renderHome();
        const key = `home_${App.currentTag}`;
        setTimeout(() => window.scrollTo(0, App.scrollPositions[key] || 0), 0);
    } else if (view === 'list') {
        header.style.display = 'block';
        backLink.style.display = 'block';
        backLink.onclick = () => navigateTo('home');
        headerSubtitle.style.display = 'none';
        miniPlayer.style.display = App.isPlaying ? 'flex' : 'none';
        App.currentAlbumId = params.albumId;
        renderList(params.albumId);
        setTimeout(() => window.scrollTo(0, App.scrollPositions['list'] || 0), 0);
    } else if (view === 'player') {
        header.style.display = 'block';
        backLink.style.display = 'block';
        backLink.onclick = () => navigateTo('list', { albumId: App.currentAlbumId });
        headerTitle.textContent = 'NOW PLAYING';
        headerSubtitle.style.display = 'none';
        miniPlayer.style.display = 'none';
        App.currentAlbumId = params.albumId;
        App.currentSongId = params.songId;
        renderPlayer(params.albumId, params.songId);
    } else if (view === 'simpleplay') {
        header.style.display = 'none';
        miniPlayer.style.display = 'none';
        App.currentAlbumId = params.albumId;
        App.currentSongId = params.songId;
        renderSimplePlay(params.albumId, params.songId);
    }
    
    updateHash(view, params);
}

function updateHash(view, params) {
    let hash = `#/${view}`;
    if (params.albumId) hash += `/${params.albumId}`;
    if (params.songId) hash += `/${params.songId}`;
    history.pushState(null, '', hash);
}

function parseHash() {
    const hash = window.location.hash.slice(2) || 'home';
    const parts = hash.split('/');
    const view = parts[0] || 'home';
    const albumId = parts[1] || null;
    const songId = parts[2] || null;
    return { view, albumId, songId };
}

function renderHome() {
    const grid = document.getElementById('albumGrid');
    const tagTabs = document.getElementById('tagTabs');
    
    const tags = getAllTags(App.allData);
    tagTabs.innerHTML = `<div class="tag-tab ${App.currentTag === 'all' ? 'active' : ''}" data-tag="all">全部</div>`;
    tags.forEach(tag => {
        tagTabs.innerHTML += `<div class="tag-tab ${App.currentTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</div>`;
    });
    
    tagTabs.querySelectorAll('.tag-tab').forEach(tab => {
        tab.onclick = () => {
            const oldKey = `home_${App.currentTag}`;
            App.scrollPositions[oldKey] = window.scrollY;
            
            App.currentTag = tab.dataset.tag;
            tagTabs.querySelectorAll('.tag-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderAlbums();
            
            const newKey = `home_${App.currentTag}`;
            window.scrollTo(0, App.scrollPositions[newKey] || 0);
        };
    });
    
    renderAlbums();
}

function renderAlbums() {
    const grid = document.getElementById('albumGrid');
    grid.innerHTML = '';
    
    let filteredData = App.allData;
    
    if (App.currentTag !== 'all') {
        filteredData = filteredData.filter(album => 
            album.tags && album.tags.includes(App.currentTag)
        );
    }
    
    if (App.searchQuery) {
        filteredData = filteredData.filter(album => {
            if (album.title && album.title.toLowerCase().includes(App.searchQuery)) return true;
            if (album.desc && album.desc.toLowerCase().includes(App.searchQuery)) return true;
            if (album.tags && album.tags.some(tag => tag.toLowerCase().includes(App.searchQuery))) return true;
            if (album.songs && album.songs.some(song => 
                (song.artist && song.artist.toLowerCase().includes(App.searchQuery)) ||
                (song.title && song.title.toLowerCase().includes(App.searchQuery))
            )) return true;
            return false;
        });
    }
    
    if (filteredData.length === 0) {
        const message = App.searchQuery 
            ? `未找到与 "${App.searchQuery}" 相关的音乐` 
            : '暂无该分类的音乐';
        grid.innerHTML = `<div style="text-align:center;color:#666;padding:40px;">${message}</div>`;
        return;
    }
    
    filteredData.forEach(album => {
        const div = document.createElement('div');
        div.className = 'album-card';
        div.onclick = () => navigateTo('list', { albumId: album.id });
        
        const tagsHtml = (album.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
        
        div.innerHTML = `
            <div class="album-info">
                <h3>${album.title}</h3>
                <p class="desc">${album.desc || ''}</p>
                ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
                <p class="meta">
                    <span class="count">${album.songs.length} 首曲目</span>
                    <span class="date">${album.releaseDate ? formatDate(album.releaseDate) : ''}</span>
                </p>
            </div>
        `;
        grid.appendChild(div);
    });
}

function renderList(albumId) {
    const album = App.allData.find(a => a.id === albumId);
    if (!album) {
        document.getElementById('headerTitle').textContent = '未找到该合集';
        return;
    }
    
    document.getElementById('headerTitle').textContent = album.title;
    document.getElementById('listDesc').textContent = album.desc || '';
    
    const listDiv = document.getElementById('songList');
    listDiv.innerHTML = '';
    
    if (album.songs.length === 0) {
        listDiv.innerHTML = "<div class='no-songs'>暂无曲目记录</div>";
        return;
    }
    
    album.songs.forEach(song => {
        const row = document.createElement('div');
        row.className = 'song-row';
        row.dataset.songId = song.id;
        if (App.currentSongId === song.id && App.isPlaying) {
            row.classList.add('playing');
        }
        
        row.innerHTML = `
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="song-actions">
                <a class="action-btn" href="${song.src}" download title="下载">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                </a>
                <span class="detail-btn" data-song-id="${song.id}">详情</span>
            </div>
        `;
        
        row.querySelector('.song-info').onclick = () => playSong(song.id, albumId);
        row.querySelector('.detail-btn').onclick = () => navigateTo('player', { albumId, songId: song.id });
        
        listDiv.appendChild(row);
    });
}

function renderPlayer(albumId, songId) {
    const album = App.allData.find(a => a.id === albumId);
    if (!album) return;
    
    const song = album.songs.find(s => s.id === songId);
    if (!song) return;
    
    document.getElementById('playerTitle').textContent = song.title;
    document.getElementById('playerArtist').textContent = song.artist;
    document.getElementById('downloadBtn').href = song.src;
    document.getElementById('downloadBtn').download = song.title + '.mp3';
    
    playSong(songId, albumId);
}

function renderSimplePlay(albumId, songId) {
    const album = App.allData.find(a => a.id === albumId);
    if (!album) return;
    
    const song = album.songs.find(s => s.id === songId);
    if (!song) return;
    
    document.getElementById('simpleDownloadBtn').href = song.src;
    document.getElementById('simpleDownloadBtn').download = song.title + '.mp3';
    
    playSong(songId, albumId);
}

function initApp() {
    App.audio = document.getElementById('audio');
    App.audio.volume = 0.8;
    
    document.getElementById('searchInput').oninput = (e) => {
        App.searchQuery = e.target.value.toLowerCase().trim();
        renderAlbums();
    };
    
    document.getElementById('playBtn').onclick = togglePlay;
    document.getElementById('miniPlayBtn').onclick = togglePlay;
    document.getElementById('miniVinyl').onclick = togglePlay;
    document.getElementById('simplePlayBtn').onclick = togglePlay;
    
    document.getElementById('prevBtn').onclick = prevSong;
    document.getElementById('nextBtn').onclick = nextSong;
    document.getElementById('miniPrevBtn').onclick = prevSong;
    document.getElementById('miniNextBtn').onclick = nextSong;
    
    document.getElementById('playModeBtn').onclick = togglePlayMode;
    
    document.getElementById('volumeSlider').oninput = (e) => changeVolume(e.target.value);
    document.getElementById('miniVolumeSlider').oninput = (e) => changeVolume(e.target.value);
    document.getElementById('volumeIcon').onclick = toggleMute;
    document.getElementById('miniVolumeIcon').onclick = toggleMute;
    
    document.getElementById('backToListBtn').onclick = () => navigateTo('list', { albumId: App.currentAlbumId });
    
    document.getElementById('headerTitle').ondblclick = () => {
        if (App.currentView === 'player' || App.currentView === 'simpleplay') {
            const path = window.location.hash.slice(1);
            const pathWithoutView = path.replace(/^\/(player|simpleplay)/, '');
            if (pathWithoutView) {
                navigator.clipboard.writeText(pathWithoutView).then(() => {
                    const title = document.getElementById('headerTitle');
                    const originalText = title.textContent;
                    title.textContent = '已复制!';
                    setTimeout(() => { title.textContent = originalText; }, 1000);
                }).catch(e => console.log('复制失败:', e));
            }
        }
    };
    
    App.audio.ontimeupdate = () => {
        if (App.isIntroLoopMode) return;
        if (App.audio.duration && isFinite(App.audio.duration)) {
            const percent = (App.audio.currentTime / App.audio.duration) * 100;
            document.getElementById('progressFill').style.width = percent + '%';
            document.getElementById('miniProgressFill').style.width = percent + '%';
            document.getElementById('simpleProgressFill').style.width = percent + '%';
            document.getElementById('currentTime').textContent = formatTime(App.audio.currentTime);
            document.getElementById('miniCurrentTime').textContent = formatTime(App.audio.currentTime);
            document.getElementById('simpleCurrentTime').textContent = formatTime(App.audio.currentTime);
        }
    };
    
    App.audio.onloadedmetadata = () => {
        if (App.isIntroLoopMode) return;
        if (App.audio.duration && isFinite(App.audio.duration)) {
            document.getElementById('duration').textContent = formatTime(App.audio.duration);
            document.getElementById('miniDuration').textContent = formatTime(App.audio.duration);
            document.getElementById('simpleDuration').textContent = formatTime(App.audio.duration);
        }
    };
    
    App.audio.onplay = () => updatePlayState(true);
    App.audio.onpause = () => updatePlayState(false);
    
    App.audio.onended = () => {
        if (App.playMode === 'single') {
            App.audio.currentTime = 0;
            App.audio.play();
        } else {
            nextSong();
        }
    };
    
    window.onpopstate = () => {
        const { view, albumId, songId } = parseHash();
        if (view !== App.currentView) {
            if (view === 'home') navigateTo('home');
            else if (view === 'list' && albumId) navigateTo('list', { albumId });
            else if (view === 'player' && albumId && songId) navigateTo('player', { albumId, songId });
            else if (view === 'simpleplay' && albumId && songId) navigateTo('simpleplay', { albumId, songId });
        }
    };
    
    fetch('/data.json')
        .then(res => res.json())
        .then(data => {
            App.allData = data.sort((a, b) => {
                const dateA = parseDate(a.releaseDate);
                const dateB = parseDate(b.releaseDate);
                return dateB - dateA;
            });
            
            const { view, albumId, songId } = parseHash();
            if (view === 'home' || !view) {
                navigateTo('home');
            } else if (view === 'list' && albumId) {
                navigateTo('list', { albumId });
            } else if (view === 'player' && albumId && songId) {
                navigateTo('player', { albumId, songId });
            } else if (view === 'simpleplay' && albumId && songId) {
                navigateTo('simpleplay', { albumId, songId });
            } else {
                navigateTo('home');
            }
        })
        .catch(err => console.error("无法读取 data.json", err));
}

document.addEventListener('DOMContentLoaded', initApp);
