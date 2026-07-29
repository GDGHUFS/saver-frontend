<script setup lang="ts">
import {RouterLink} from 'vue-router'

import PageScaffold from '@/components/PageScaffold.vue'

const brandIconUrl = `${import.meta.env.BASE_URL}android-chrome-512x512.png`
</script>

<template>
  <PageScaffold title="서비스 소개">
    <section class="mb-5">
      <h1>SAVER</h1>
      <section class="mb-5 card w-75 p-3">
        <img
            class="m-3 card-img-top"
            :src="brandIconUrl"
            alt="SAVER의 로고입니다."
            aria-hidden="true"
        />
        <div class="card-body">
          SAVER는 외부 API 중심으로 구성된 포털 서비스입니다. 검색으로 궁금증을 해결할 수도 있으며, 날씨나 최신 뉴스를 확인할 수도 있어요.
          또, 블로그를 통해 간단한 노트도 남길 수 있답니다.
        </div>
      </section>
    </section>
    <section class="mb-5">
      <h2>기능 소개</h2>
      <div class="accordion mb-5" id="accordion">
        <div class="accordion-item">
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button" type="button" data-bs-toggle="collapse"
                      data-bs-target="#collapseSearch" aria-expanded="true" aria-controls="collapseSearch">
                검색
              </button>
            </h2>
            <div id="collapseSearch" class="accordion-collapse collapse show" data-bs-parent="#accordion">
              <div class="accordion-body">
                포털 서비스에는 검색이 빠질 수 없죠.
                SAVER는 다양한 검색 결과와 고품질의 검색 결과 사이 절충을 맞춘 <strong><a href="https://kagi.com/"
                                                                  target="_blank">Kagi</a></strong>를 검색 결과 공급자로 사용합니다.
                <br/>또한, OpenAI를 통해 사용자의 검색어와 관련된 AI 요약을 빠르게 제공하죠.
              </div>
            </div>
          </div>
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne"
                    aria-expanded="false" aria-controls="collapseOne">
              뉴스
            </button>
          </h2>
          <div id="collapseOne" class="accordion-collapse collapse" data-bs-parent="#accordion">
            <div class="accordion-body">
              SAVER는 사용자에게 뉴스 서비스도 제공하고 있답니다. 기존에 흔히 쓰이는 방식인 웹 스크래핑이 아닌, <strong>RSS</strong>를 통해 뉴스를 수집한다는 점에서 차이가 있어요.
              SAVER가 RSS 링크로 요청을 보내면, 뉴스 발행자가 최신 뉴스 목록을 보내주는 방식이에요.
              뉴스 발행자는 최신 뉴스는 물론이고, 다른 RSS 링크를 제공해서 인기 뉴스 같이 뉴스 발행자 중심으로 컨텐츠를 공급할 수 있어요.
              SAVER는 이 발행자 중심 컨텐츠 제공을 서비스하고 있답니다.
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
              날씨
            </button>
          </h2>
          <div id="collapseTwo" class="accordion-collapse collapse" data-bs-parent="#accordion">
            <div class="accordion-body">
              날씨는 시도때도 없이 바뀌기에 수시로 최신 정보를 가져와야 해요.
              SAVER는 기상청의 API를 이용해서 초단기 기상 정보를 받아오고 있답니다.
              <br/>사용자는 주소를 직접 검색하거나, 현재 위치를 제공하여(물론 SAVER는 이 정보를 저장하지 않아요!) 지역의 날씨를 볼 수 있어요.
              또, 대한민국 지도 위에 주요 도시 날씨들을 표시하여 한 눈에 볼 수도 있다는 사실!
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
              기념일
            </button>
          </h2>
          <div id="collapseThree" class="accordion-collapse collapse" data-bs-parent="#accordion">
            <div class="accordion-body">
              기념일에는 공휴일 외에도, 24절기 같은 전통 기념일이 있어요.
              SAVER는 이 정보를 제공하는 공공API를 활용하여 달력에서 보기 편하게 서비스하고 있답니다.
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#collapseBlog" aria-expanded="false" aria-controls="collapseBlog">
              블로그
            </button>
          </h2>
          <div id="collapseBlog" class="accordion-collapse collapse" data-bs-parent="#accordion">
            <div class="accordion-body">
              SAVER에서 블로그도 작성할 수 있어요! 혹은 다른 사람들이 쓴 블로그도 볼 수 있답니다!
            </div>
          </div>
        </div>
      </div>
    </section>
    <div class="mb-5">
      <h3>만든 이</h3>
      <ul>
        <li>손재혁</li>
        <li>서정훈</li>
        <li>정승엽</li>
        <li>조해원</li>
        <li>홍혜원</li>
      </ul>
    </div>
    <RouterLink to="/privacy">개인정보처리방침</RouterLink>
  </PageScaffold>
</template>
