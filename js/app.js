// PDF閱讀器與多媒體播放器整合應用
// 適用於 GitHub 倉庫: chday169/pdf-vedio-web

// PDF閱讀器變數
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');

// 多媒體播放器變數
let currentMediaType = null; // 'youtube', 'mp4', 'audio'
let youtubePlayer = null;
let currentPdfId = null;
let currentMediaId = null;

// 載入外部 JSON 檔案
let pdfManifest = [];
let mediaManifest = [];

// 載入 PDF 清單
async function loadPdfManifest() {
    try {
        const response = await fetch('data/pdf-manifest.json');
        if (!response.ok) {
            throw new Error('無法載入 PDF 清單');
        }
        pdfManifest = await response.json();
        initPdfList();
        
        console.log('PDF 清單載入成功，共', pdfManifest.length, '個項目');
    } catch (error) {
        console.error('載入 PDF 清單失敗:', error);
        document.getElementById('pdf-list-container').innerHTML = 
            '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> 無法載入 PDF 清單，請檢查網路連線</div>';
    }
}

// 載入媒體清單
async function loadMediaManifest() {
    try {
        const response = await fetch('data/media-manifest.json');
        if (!response.ok) {
            throw new Error('無法載入媒體清單');
        }
        mediaManifest = await response.json();
        initMediaList();
        
        console.log('媒體清單載入成功，共', mediaManifest.length, '個項目');
        
        // 預設載入第一個媒體項目
        if (mediaManifest.length > 0) {
            const firstMedia = document.querySelector('.media-item');
            if (firstMedia) {
                firstMedia.classList.add('active');
                const mediaId = firstMedia.dataset.id;
                const media = mediaManifest.find(m => m.id === mediaId);
                if (media) {
                    loadMedia(media);
                }
            }
        }
    } catch (error) {
        console.error('載入媒體清單失敗:', error);
        document.getElementById('media-list-container').innerHTML = 
            '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> 無法載入媒體清單，請檢查網路連線</div>';
    }
}

// 初始化PDF清單
function initPdfList() {
    const pdfListContainer = document.getElementById('pdf-list-container');
    const pdfSelect = document.getElementById('pdf-select');
    
    // 清空現有內容
    pdfListContainer.innerHTML = '';
    pdfSelect.innerHTML = '<option value="">請選擇PDF文件</option>';
    
    // 如果沒有PDF項目
    if (pdfManifest.length === 0) {
        pdfListContainer.innerHTML = '<div class="empty-message"><i class="fas fa-info-circle"></i> 目前沒有PDF文件</div>';
        return;
    }
    
    // 添加每個PDF項目
    pdfManifest.forEach(pdf => {
        // 添加到下拉選單
        const option = document.createElement('option');
        option.value = pdf.id;
        option.textContent = pdf.title.length > 50 ? pdf.title.substring(0, 50) + '...' : pdf.title;
        pdfSelect.appendChild(option);
        
        // 添加到清單顯示
        const pdfItem = document.createElement('div');
        pdfItem.className = 'pdf-item';
        pdfItem.dataset.id = pdf.id;
        pdfItem.title = pdf.title;
        
        const shortTitle = pdf.title.length > 60 ? pdf.title.substring(0, 60) + '...' : pdf.title;
        
        pdfItem.innerHTML = `
            <div class="item-title">${shortTitle}</div>
            <div class="pdf-stats">
                <span><i class="fas fa-eye"></i> ${pdf.views}</span>
                <span><i class="fas fa-heart"></i> ${pdf.likes}</span>
            </div>
        `;
        
        // 點擊事件
        pdfItem.addEventListener('click', () => {
            // 移除所有active類別
            document.querySelectorAll('.pdf-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // 添加active類別到當前項目
            pdfItem.classList.add('active');
            
            // 設定選擇框
            pdfSelect.value = pdf.id;
            
            // 載入PDF
            loadPDFByUrl(pdf.url, pdf.id);
        });
        
        pdfListContainer.appendChild(pdfItem);
    });
}

// 初始化多媒體清單
function initMediaList() {
    const mediaListContainer = document.getElementById('media-list-container');
    
    // 清空現有內容
    mediaListContainer.innerHTML = '';
    
    // 如果沒有媒體項目
    if (mediaManifest.length === 0) {
        mediaListContainer.innerHTML = '<div class="empty-message"><i class="fas fa-info-circle"></i> 目前沒有媒體文件</div>';
        return;
    }
    
    // 添加每個多媒體項目
    mediaManifest.forEach(media => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        mediaItem.dataset.id = media.id;
        mediaItem.dataset.type = media.type;
        mediaItem.title = media.title;
        
        // 根據類型決定CSS類別
        const typeClass = media.type === 'youtube' ? 'youtube' : 
                         media.type === 'mp4' ? 'mp4' : 'audio';
        
        const typeIcon = media.type === 'youtube' ? 'fab fa-youtube' : 
                        media.type === 'mp4' ? 'fas fa-video' : 'fas fa-music';
        
        const shortTitle = media.title.length > 60 ? media.title.substring(0, 60) + '...' : media.title;
        
        mediaItem.innerHTML = `
            <div class="item-type ${typeClass}"><i class="${typeIcon}"></i> ${media.type.toUpperCase()}</div>
            <div class="item-title">${shortTitle}</div>
        `;
        
        // 點擊事件
        mediaItem.addEventListener('click', () => {
            // 移除所有active類別
            document.querySelectorAll('.media-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // 添加active類別到當前項目
            mediaItem.classList.add('active');
            
            // 載入媒體
            loadMedia(media);
        });
        
        mediaListContainer.appendChild(mediaItem);
    });
}

// 通過URL載入PDF
function loadPDFByUrl(url, pdfId) {
    if (currentPdfId === pdfId && pdfDoc) {
        return; // 已經載入，不需要重新載入
    }
    
    currentPdfId = pdfId;
    
    // 更新瀏覽次數
    const pdfItem = pdfManifest.find(pdf => pdf.id === pdfId);
    if (pdfItem) {
        pdfItem.views++;
        updatePdfStats(pdfId);
    }
    
    // 顯示載入中
    document.getElementById('pdf-loader').innerHTML = `
        <i class="fas fa-spinner fa-spin fa-3x"></i>
        <p>載入PDF中...</p>
    `;
    document.getElementById('pdf-loader').style.display = 'block';
    document.getElementById('pdf-canvas').style.display = 'none';
    
    // 載入PDF
    pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('page-count').textContent = pdfDoc.numPages;
        pageNum = 1;
        scale = 1.0;
        renderPage(pageNum);
        
        console.log('PDF載入成功:', pdfId);
    }).catch(error => {
        console.error('PDF載入錯誤:', error);
        document.getElementById('pdf-loader').innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x" style="color:#e74c3c;"></i>
            <p style="color:#e74c3c;">PDF載入失敗</p>
            <p>請檢查網路連線或PDF網址</p>
        `;
    });
}

// 更新PDF統計
function updatePdfStats(pdfId) {
    const pdfItem = pdfManifest.find(pdf => pdf.id === pdfId);
    if (pdfItem) {
        const pdfElement = document.querySelector(`.pdf-item[data-id="${pdfId}"] .pdf-stats`);
        if (pdfElement) {
            pdfElement.innerHTML = `<span><i class="fas fa-eye"></i> ${pdfItem.views}</span><span><i class="fas fa-heart"></i> ${pdfItem.likes}</span>`;
        }
    }
}

// 渲染PDF頁面
function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({scale: scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        renderTask.promise.then(function() {
            pageRendering = false;
            document.getElementById('pdf-canvas').style.display = 'block';
            document.getElementById('pdf-loader').style.display = 'none';
            document.getElementById('page-num').textContent = num;
            
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// 載入媒體
function loadMedia(media) {
    currentMediaId = media.id;
    currentMediaType = media.type;
    
    // 更新當前播放標題
    document.getElementById('current-media-title').innerHTML = `<i class="fas fa-play-circle"></i> 正在播放: ${media.title}`;
    
    // 顯示下載按鈕（僅限本地檔案）
    const downloadBtn = document.getElementById('download-media');
    if (media.type === 'mp4' || media.type === 'audio') {
        downloadBtn.style.display = 'inline-flex';
        downloadBtn.onclick = () => {
            window.open(media.url, '_blank');
        };
    } else {
        downloadBtn.style.display = 'none';
    }
    
    // 隱藏所有播放器
    document.getElementById('youtube-player').style.display = 'none';
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('audio-player').style.display = 'none';
    
    // 根據類型載入相應的播放器
    if (media.type === 'youtube') {
        loadYouTubeVideo(media.url);
    } else if (media.type === 'mp4') {
        loadMP4Video(media.url);
    } else if (media.type === 'audio') {
        loadAudio(media.url);
    }
}

// 載入YouTube影片
function loadYouTubeVideo(url) {
    const youtubePlayerEl = document.getElementById('youtube-player');
    youtubePlayerEl.style.display = 'block';
    
    // 提取YouTube影片ID
    const videoId = extractYouTubeIDFromUrl(url);
    
    if (videoId) {
        youtubePlayerEl.innerHTML = `
            <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
        
        // 載入YouTube API
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = function() {
                youtubePlayer = new YT.Player(youtubePlayerEl.querySelector('iframe'), {
                    events: {
                        'onReady': onPlayerReady,
                        'onStateChange': onPlayerStateChange
                    }
                });
            };
        } else if (window.YT && window.YT.Player) {
            // 如果API已經載入，但播放器還沒初始化
            if (!youtubePlayer) {
                youtubePlayer = new YT.Player(youtubePlayerEl.querySelector('iframe'), {
                    events: {
                        'onReady': onPlayerReady,
                        'onStateChange': onPlayerStateChange
                    }
                });
            }
        }
    } else {
        youtubePlayerEl.innerHTML = '<div style="color:red; text-align:center; padding:50px;"><i class="fas fa-exclamation-triangle"></i> 無法解析YouTube網址</div>';
    }
}

// 從YouTube URL提取影片ID
function extractYouTubeIDFromUrl(url) {
    // 多種格式的YouTube URL支援
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        /youtube\.com\/user\/.*#.*\/.*\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // 如果輸入的是純ID
    if (url.length === 11 && !url.includes('/') && !url.includes('?')) {
        return url;
    }
    
    return null;
}

// 載入MP4影片
function loadMP4Video(url) {
    const videoPlayer = document.getElementById('video-player');
    videoPlayer.style.display = 'block';
    videoPlayer.src = url;
    videoPlayer.load();
}

// 載入音訊
function loadAudio(url) {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.style.display = 'block';
    audioPlayer.src = url;
    audioPlayer.load();
}

// YouTube播放器回調函數
function onPlayerReady(event) {
    console.log('YouTube播放器準備就緒');
}

function onPlayerStateChange(event) {
    // 可在此添加播放狀態變化處理
}

// 手動輸入YouTube網址載入
document.getElementById('load-youtube').addEventListener('click', () => {
    const videoInput = document.getElementById('video-url').value.trim();
    if (!videoInput) {
        alert('請輸入YouTube影片網址或ID');
        return;
    }
    
    let videoId;
    if (videoInput.length === 11 && !videoInput.includes('/')) {
        videoId = videoInput;
    } else {
        videoId = extractYouTubeIDFromUrl(videoInput);
    }
    
    if (!videoId) {
        alert('請輸入有效的YouTube影片網址或ID');
        return;
    }
    
    const tempMedia = {
        id: 'custom_youtube',
        title: '自訂YouTube影片',
        type: 'youtube',
        url: `https://www.youtube.com/embed/${videoId}`
    };
    
    loadMedia(tempMedia);
    document.getElementById('current-media-title').innerHTML = `<i class="fas fa-play-circle"></i> 正在播放: 自訂YouTube影片`;
});

// 多媒體控制按鈕
document.getElementById('play-media').addEventListener('click', () => {
    if (currentMediaType === 'youtube' && youtubePlayer && youtubePlayer.playVideo) {
        youtubePlayer.playVideo();
    } else if (currentMediaType === 'mp4') {
        document.getElementById('video-player').play();
    } else if (currentMediaType === 'audio') {
        document.getElementById('audio-player').play();
    }
});

document.getElementById('pause-media').addEventListener('click', () => {
    if (currentMediaType === 'youtube' && youtubePlayer && youtubePlayer.pauseVideo) {
        youtubePlayer.pauseVideo();
    } else if (currentMediaType === 'mp4') {
        document.getElementById('video-player').pause();
    } else if (currentMediaType === 'audio') {
        document.getElementById('audio-player').pause();
    }
});

document.getElementById('mute-media').addEventListener('click', () => {
    const muteBtn = document.getElementById('mute-media');
    
    if (currentMediaType === 'youtube' && youtubePlayer) {
        if (youtubePlayer.isMuted && youtubePlayer.isMuted()) {
            youtubePlayer.unMute();
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i> 靜音';
        } else {
            youtubePlayer.mute();
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i> 取消靜音';
        }
    } else if (currentMediaType === 'mp4') {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.muted = !videoPlayer.muted;
        muteBtn.innerHTML = videoPlayer.muted ? 
            '<i class="fas fa-volume-up"></i> 取消靜音' : 
            '<i class="fas fa-volume-mute"></i> 靜音';
    } else if (currentMediaType === 'audio') {
        const audioPlayer = document.getElementById('audio-player');
        audioPlayer.muted = !audioPlayer.muted;
        muteBtn.innerHTML = audioPlayer.muted ? 
            '<i class="fas fa-volume-up"></i> 取消靜音' : 
            '<i class="fas fa-volume-mute"></i> 靜音';
    }
});

document.getElementById('fullscreen-media').addEventListener('click', () => {
    if (currentMediaType === 'youtube') {
        const iframe = document.querySelector('#youtube-player iframe');
        if (iframe) {
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen();
            } else if (iframe.webkitRequestFullscreen) {
                iframe.webkitRequestFullscreen();
            } else if (iframe.mozRequestFullScreen) {
                iframe.mozRequestFullScreen();
            } else if (iframe.msRequestFullscreen) {
                iframe.msRequestFullscreen();
            }
        }
    } else if (currentMediaType === 'mp4') {
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer.requestFullscreen) {
            videoPlayer.requestFullscreen();
        }
    }
});

// PDF控制按鈕事件
document.getElementById('load-pdf').addEventListener('click', () => {
    const pdfSelect = document.getElementById('pdf-select');
    const selectedId = pdfSelect.value;
    
    if (!selectedId) {
        alert('請選擇PDF文件');
        return;
    }
    
    const pdfItem = pdfManifest.find(pdf => pdf.id === selectedId);
    if (pdfItem) {
        // 更新清單中的active狀態
        document.querySelectorAll('.pdf-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === selectedId) {
                item.classList.add('active');
            }
        });
        
        loadPDFByUrl(pdfItem.url, selectedId);
    }
});

document.getElementById('prev-page').addEventListener('click', () => {
    if (pdfDoc === null || pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
});

document.getElementById('next-page').addEventListener('click', () => {
    if (pdfDoc === null || pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
});

document.getElementById('zoom-in').addEventListener('click', () => {
    if (pdfDoc === null) return;
    scale += 0.2;
    renderPage(pageNum);
});

document.getElementById('zoom-out').addEventListener('click', () => {
    if (pdfDoc === null || scale <= 0.2) return;
    scale -= 0.2;
    renderPage(pageNum);
});

document.getElementById('fit-width').addEventListener('click', () => {
    if (pdfDoc === null) return;
    // 計算適合寬度的縮放比例
    const containerWidth = document.getElementById('pdf-container').clientWidth - 40;
    pdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({scale: 1});
        scale = containerWidth / viewport.width;
        renderPage(pageNum);
    });
});

// 初始化
window.onload = function() {
    console.log('應用程式初始化...');
    loadPdfManifest();
    loadMediaManifest();
};