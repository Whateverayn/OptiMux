export namespace main {
	
	export class EncodeOptions {
	    codec: string;
	    audio: string;
	    extension: string;
	
	    static createFrom(source: any = {}) {
	        return new EncodeOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codec = source["codec"];
	        this.audio = source["audio"];
	        this.extension = source["extension"];
	    }
	}
	export class MediaInfo {
	    path: string;
	    hasVideo: boolean;
	    hasAudio: boolean;
	    duration: number;
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.hasVideo = source["hasVideo"];
	        this.hasAudio = source["hasAudio"];
	        this.duration = source["duration"];
	    }
	}

}

