// tính năng:
// play/pause/next/prev/repeat/shuffle
// trích xuất metadata của audio file dùng thư viện jsmediatags (chatgpt)
// phím tắt để play/pause, chuyển bài

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const jsmediatags = window.jsmediatags;

const player = {
    NEXT: 1,
    PREV: -1,
    REPLAY_THRESHOLD: 2,

    playlist: $(".playlist"),
    songTitle: $(".song-title"),
    songArtist: $(".song-artist"),
    cdThumb: $(".cd-thumb"),
    audioElement: $(".audio"),
    playPauseBtn: $(".play-pause-btn"),
    playPauseIcon: $(".play-pause-icon"),
    prevBtn: $(".prev-btn"),
    nextBtn: $(".next-btn"),
    repeatBtn: $(".repeat-btn"),
    shuffleBtn: $(".shuffle-btn"),
    progressBar: $(".progress-bar-wrapper"),
    innerProgressBar: $(".inner-progress-bar"),
    slider: $(".slider"),
    elapsedTime: $(".elapsed-time"),
    totalDuration: $(".total-duration"),

    songPaths: [
        "./musics/Hey Daddy (Daddy's Home).mp3",
        // "./musics/So Far Away.mp3",
        "./musics/Những Lời Hứa Bỏ Quên.mp3",
        "./musics/Phố Không Em.mp3",
        "./musics/Chờ Anh Nhé.mp3",
        // "./musics/Stereo Love (Original).mp3",
        "./musics/KeoBonMua.mp3",
        "./musics/ThichEmNhungMaKhoanYeu.mp3",
        "./musics/Yêu Em Dài Lâu - Yêu 5.mp3",
    ],

    songs: [],
    unplayedSongIndexes: [],

    currentIndex: 0,
    isSeeking: false,
    isRepeated: localStorage.getItem("isRepeated") === "true",
    isShuffled: localStorage.getItem("isShuffled") === "true",

    // 2. Create a helper function to read tags using Promises
    getSongTags(file) {
        return new Promise((resolve, reject) => {
            jsmediatags.read(file, {
                onSuccess: (tag) => {
                    resolve(tag);
                },
                onError: (error) => {
                    reject(error);
                },
            });
        });
    },

    // 3. Main function to build the playlist from file paths
    async buildPlaylist() {
        console.log("Building playlist from local files...");
        const songPromises = this.songPaths.map(async (path, index) => {
            try {
                // Fetch the mp3 file as a Blob
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(
                        `HTTP error! status: ${response.status} for ${path}`
                    );
                }
                const fileBlob = await response.blob();

                // Read the metadata tags from the Blob
                const tags = await this.getSongTags(fileBlob);

                // Handle the cover art
                let coverArtUrl = "./assets/default-covert-art-1.jpg"; // A fallback image
                const picture = tags.tags.picture;
                if (picture) {
                    const blob = new Blob([new Uint8Array(picture.data)], {
                        type: picture.format,
                    });
                    coverArtUrl = URL.createObjectURL(blob);
                }

                // Construct the final song object
                return {
                    id: index,
                    title:
                        tags.tags.title ||
                        path.split("/").pop().replace(".mp3", ""),
                    artist: tags.tags.artist || "Unknown Artist",
                    album: tags.tags.album || "Unknown Album",
                    path: path,
                    coverArtUrl: coverArtUrl,
                };
            } catch (error) {
                console.error(`Failed to process song: ${path}`, error);
                // Return a default object so the playlist doesn't break
                return {
                    id: index,
                    title: path.split("/").pop().replace(".mp3", ""), // Filename as fallback
                    artist: "Unknown Artist",
                    path: path,
                    coverArtUrl: "./assets/default-covert-art-1.jpg", // default covert art
                };
            }
        });

        // Wait for all the song processing to complete
        this.songs = await Promise.all(songPromises);
        console.log("Playlist built successfully:", this.songs);
    },

    createArray(n) {
        return Array(n)
            .fill(0)
            .map((_, i) => i);
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    getProgressBarCoord(element) {
        const rect = element.getBoundingClientRect();
        return [rect.left, rect.left + element.offsetWidth];
    },

    formatTime(sec) {
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec % 3600) / 60);
        const seconds = Math.round(sec % 60);
        return `${
            hours > 0 ? String(hours).padStart(2, "0") + ":" : ""
        }${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
            2,
            "0"
        )}`;
    },

    loadCurrentSong() {
        const currentSong = this.songs[this.currentIndex];
        // update song title
        this.songTitle.textContent = currentSong.title;
        // update song artist
        this.songArtist.textContent = currentSong.artist;
        // update cd thumbnail
        this.cdThumb.src = currentSong.coverArtUrl;
        // update audio source
        this.audioElement.src = currentSong.path;
        // update duration
        this.audioElement.addEventListener(
            "loadedmetadata",
            () => {
                this.totalDuration.textContent = this.formatTime(
                    this.audioElement.duration
                );
            },
            { once: true }
        );
    },

    loadRenderAndPlay() {
        this.loadCurrentSong();
        this.renderPlaylist();
        this.audioElement.play();

        // stop rotating cd-thumb
        this.cdThumb.classList.remove("playing");
    },

    removeElementFromUnplayedSongIndexes(element) {
        const index = this.unplayedSongIndexes.indexOf(element);
        if (index !== -1) {
            this.unplayedSongIndexes.splice(index, 1);
        }
    },

    switchSong(direction) {
        if (this.isShuffled) {
            // bật shuffle thì phát các bài có index trong unplayedSongIndexes
            if (this.unplayedSongIndexes.length) {
                // gán currentIndex = phần tử đầu tiên của unplayedSongIndexes, xong rồi xóa luôn
                this.currentIndex = this.unplayedSongIndexes[0];

                // xóa phần tử đầu tiên của mảng unplayedSongIndexes
                this.unplayedSongIndexes.splice(0, 1);
            } else {
                // khi this.unplayedSongIndexes.length === 0 --> tất cả đã được phát

                // reset mảng unplayedSongIndexes
                this.unplayedSongIndexes = this.createArray(this.songs.length);

                // xóa phần tử currentIndex hiện tại khỏi mảng unplayedSongIndexes
                this.removeElementFromUnplayedSongIndexes(this.currentIndex);

                // shuffle
                this.shuffleArray(this.unplayedSongIndexes);

                // gán currentIndex = phần tử đầu tiên của unplayedSongIndexes, xong rồi xóa luôn
                this.currentIndex = this.unplayedSongIndexes[0];
                this.removeElementFromUnplayedSongIndexes(this.currentIndex);
            }
        } else {
            // không bật shuffle
            this.currentIndex =
                (this.currentIndex + direction + this.songs.length) %
                this.songs.length;

            // xóa phần tử currentIndex khỏi mảng unplayedSongIndexes
            this.removeElementFromUnplayedSongIndexes(this.currentIndex);
        }
        this.loadRenderAndPlay();
    },

    // ===== HANDLERS =====
    handlePlayPauseClick() {
        if (this.audioElement.paused) {
            this.audioElement.play();
        } else {
            this.audioElement.pause();
        }
    },

    handleAudioPlay() {
        this.playPauseIcon.classList.add("fa-pause");
        this.playPauseIcon.classList.remove("fa-play");

        this.cdThumb.classList.add("playing");
        this.cdThumb.style.animationPlayState = "running"; // rotate cd-thumb
    },

    handleAudioPause() {
        this.playPauseIcon.classList.add("fa-play");
        this.playPauseIcon.classList.remove("fa-pause");

        this.cdThumb.style.animationPlayState = "paused"; // pause rotating cd-thumb
    },

    handlePreviousClick() {
        // nhạc phát được ít hơn 2s thì chuyển bài
        // nhạc phát được nhiều hơn 2s thì phát lại
        if (this.audioElement.currentTime > this.REPLAY_THRESHOLD) {
            this.audioElement.currentTime = 0;
        } else {
            this.switchSong(this.PREV);
        }
    },

    handleNextClick() {
        this.switchSong(this.NEXT);
    },

    handleAudioTimeUpdate() {
        const { duration, currentTime } = this.audioElement;

        // vì khi file chưa load xong, giá trị ban đầu duration là NaN
        // hoặc người dùng đang tua thì không update progress bar
        if (!duration || this.isSeeking) return;

        // update elapsedTime
        this.elapsedTime.textContent = this.formatTime(
            this.audioElement.currentTime
        );

        const progressbarWidth = this.progressBar.offsetWidth;

        // quãng đường inner progressbar và slider cần di chuyển
        const distanceX = progressbarWidth * (currentTime / duration); // pixel

        // move innerProgressBar
        this.innerProgressBar.style.translate = `${
            distanceX - progressbarWidth
        }px`;

        // update slider position
        this.slider.style.left = `${distanceX}px`;
    },

    handleProgressBarMouseDown() {
        this.isSeeking = true;

        // style innerProgressBar + slider
        this.innerProgressBar.style.background = "#ec1f55"; // #1db954
        this.slider.style.visibility = "visible";
    },

    handleDocumentMouseUp(e) {
        if (this.isSeeking) {
            // reset style for innerProgressBar + slider
            this.innerProgressBar.style.background = null;
            this.slider.style.visibility = null;

            // tính toán audio.currentTime dựa trên vị trí nhả chuột
            let progressPercentage;
            const currentXCoord = e.clientX;
            const progressbarWidth = this.progressBar.offsetWidth;

            // leftProgressBarCoord: tọa độ theo trục X của điểm đầu của progressBar
            // rightProgressBarCoord: tọa độ theo trục X của điểm cuối của progressBar
            const [leftProgressBarCoord, rightProgressBarCoord] =
                this.getProgressBarCoord(this.progressBar);

            if (currentXCoord < leftProgressBarCoord) {
                progressPercentage = 0;
            } else if (currentXCoord > rightProgressBarCoord) {
                progressPercentage = 100;
            } else {
                progressPercentage =
                    ((currentXCoord - leftProgressBarCoord) * 100) /
                    progressbarWidth;
            }

            // update audio currentTime
            this.audioElement.currentTime =
                (progressPercentage * this.audioElement.duration) / 100;
        }

        this.isSeeking = false;
    },

    handleDocumentMouseMove(e) {
        if (this.isSeeking) {
            const currentXCoord = e.clientX; // tọa độ chuột trục X
            const progressbarWidth = this.progressBar.offsetWidth;

            // leftProgressBarCoord: tọa độ theo trục X của điểm đầu của progressBar
            // rightProgressBarCoord: tọa độ theo trục X của điểm cuối của progressBar
            const [leftProgressBarCoord, rightProgressBarCoord] =
                this.getProgressBarCoord(this.progressBar);

            // quãng đường cần di chuyển cho innerProgressBar và slider
            const distanceX = currentXCoord - leftProgressBarCoord;

            // tọa độ chuột trong khoảng cho phép thì di chuyển innerProgressBar và slider
            // tọa độ điểm đầu progressBar <= currentXCoord <= tọa độ điểm cuối progressBar
            if (
                currentXCoord >= leftProgressBarCoord &&
                currentXCoord <= rightProgressBarCoord
            ) {
                // di chuyển innerProgressBar
                this.innerProgressBar.style.translate = `${
                    distanceX - progressbarWidth
                }px`;
                // update slider position
                this.slider.style.left = `${distanceX}px`;
                // update elapsedTime
                this.elapsedTime.textContent = this.formatTime(
                    (this.audioElement.duration * distanceX) / progressbarWidth
                );
            }
        }
    },

    handleRepeatClick() {
        this.isRepeated = !this.isRepeated;
        // change icon style
        this.repeatBtn.classList.toggle("active", this.isRepeated);
        // save to localStorage
        localStorage.setItem("isRepeated", this.isRepeated);
    },

    handleAudioEnded() {
        if (this.isRepeated) {
            this.audioElement.play();
        } else {
            this.switchSong(this.NEXT);
        }
    },

    handleShuffleClick() {
        this.isShuffled = !this.isShuffled;
        // change icon style
        this.shuffleBtn.classList.toggle("active", this.isShuffled);
        // save to localStorage
        localStorage.setItem("isShuffled", this.isShuffled);

        if (this.isShuffled) {
            // enabled
            this.shuffleArray(this.unplayedSongIndexes);
        } else {
            // disabled
            // reset mảng unplayedSongIndexes
            this.unplayedSongIndexes = this.createArray(this.songs.length);
        }
    },

    handlePlaylistClick(e) {
        const song = e.target.closest(".song");
        if (!song) return;

        this.currentIndex = +song.dataset.index; // convert to number

        // xóa phần tử currentIndex hiện tại khỏi mảng unplayedSongIndexes
        this.removeElementFromUnplayedSongIndexes(this.currentIndex);

        this.loadRenderAndPlay();
    },

    handleDocumentKeyDown(e) {
        if (e.key === " ") {
            e.preventDefault(); // ngăn chặn hành vi cuộn khi nhấn space
            if (this.audioElement.paused) {
                this.audioElement.play();
            } else {
                this.audioElement.pause();
            }
        } else if (e.key === "ArrowLeft") {
            this.switchSong(this.PREV);
        } else if (e.key === "ArrowRight") {
            this.switchSong(this.NEXT);
        }
    },

    setupEventListeners() {
        this.playPauseBtn.addEventListener("click", () => {
            this.handlePlayPauseClick();
        });

        // change icons when playing + rotate cd-thumb
        this.audioElement.addEventListener("play", () => {
            this.handleAudioPlay();
        });

        // change icons when pausing + pause rotating cd-thumb
        this.audioElement.addEventListener("pause", () => {
            this.handleAudioPause();
        });

        // prev, next button
        this.prevBtn.addEventListener("click", () => {
            this.handlePreviousClick();
        });
        this.nextBtn.addEventListener("click", () => {
            this.handleNextClick();
        });

        // --- CUSTOM PROGRESS BAR ---
        // update progress bar
        this.audioElement.addEventListener("timeupdate", () => {
            this.handleAudioTimeUpdate();
        });

        // REWIND/FORWARD FEATURE
        this.progressBar.addEventListener("mousedown", () => {
            this.handleProgressBarMouseDown();
        });

        document.addEventListener("mouseup", (e) => {
            this.handleDocumentMouseUp(e);
        });

        document.addEventListener("mousemove", (e) => {
            this.handleDocumentMouseMove(e);
        });

        // repeat button
        this.repeatBtn.addEventListener("click", () => {
            this.handleRepeatClick();
        });

        // when a song ends
        this.audioElement.addEventListener("ended", () => {
            this.handleAudioEnded();
        });

        // shuffle button
        this.shuffleBtn.addEventListener("click", () => {
            this.handleShuffleClick();
        });

        // khi click vào song
        this.playlist.addEventListener("click", (e) => {
            this.handlePlaylistClick(e);
        });

        // shortcut
        document.addEventListener("keydown", (e) => {
            this.handleDocumentKeyDown(e);
        });
    },

    async initialize() {
        // Build the playlist first
        await this.buildPlaylist();

        // Once the playlist is built, load the first song and render the UI
        if (this.songs.length <= 0) return;

        // khởi tạo unplayedSongIndexes
        this.unplayedSongIndexes = this.createArray(this.songs.length);
        this.unplayedSongIndexes.shift();

        this.loadCurrentSong();

        this.setupEventListeners();

        this.renderPlaylist();

        // update repeat button state
        this.repeatBtn.classList.toggle("active", this.isRepeated);
        // update shuffle button state
        this.shuffleBtn.classList.toggle("active", this.isShuffled);
        // nếu shuffle đang bật thì xáo trộn mảng
        if (this.isShuffled) {
            this.shuffleArray(this.unplayedSongIndexes);
        }
    },

    renderPlaylist() {
        const html = this.songs
            .map((song, index) => {
                return `
                    <li class="song ${
                        this.currentIndex === index ? "active" : ""
                    }" data-index="${index}">
                            <img
                                class="cover-art"
                                src="${song.coverArtUrl}"
                                alt=""
                            />
                            <div class="song-info">
                                <h3 class="song-title">
                                    ${this.escapeHTML(song.title)}
                                </h3>
                                <p class="song-artist">
                                    ${this.escapeHTML(song.artist)}
                                </p>
                            </div>
                            <button class="option">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </li>
                `;
            })
            .join("");

        this.playlist.innerHTML = html;
    },

    escapeHTML(str) {
        const element = document.createElement("div");
        element.textContent = str;
        return element.innerHTML;
    },
};

player.initialize();
