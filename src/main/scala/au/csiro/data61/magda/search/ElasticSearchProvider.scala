package au.csiro.data61.magda.search

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.ElasticsearchClientUri
import com.sksamuel.elastic4s.source.Indexable
import com.sksamuel.elastic4s.mappings.FieldType._
import com.sksamuel.elastic4s.analyzers.StopAnalyzer

import au.csiro.data61.magda.api.Types._
import au.csiro.data61.magda.api.Types.Protocols._
import spray.json._
import spray.json.JsValue
import spray.json.RootJsonFormat
import scala.concurrent.Future
import scala.concurrent.ExecutionContext
import com.sksamuel.elastic4s.RichSearchHit
import com.sksamuel.elastic4s.HitAs



class ElasticSearchProvider(implicit val ec: ExecutionContext) extends SearchProvider {
  implicit object SprayJsonIndexable extends Indexable[JsValue] {
    override def json(t: JsValue): String = t.toString(CompactPrinter)
  }

  implicit object DataSetHitAs extends HitAs[DataSet] {
    override def as(hit: RichSearchHit): DataSet = {
      hit.sourceAsString.parseJson.convertTo[DataSet]
    }
  }

  val uri = ElasticsearchClientUri("elasticsearch://search:9300")
  val client = ElasticClient.transport(uri)
  val setupFuture = setup()

  def setup(): Future[Any] = {
    client.execute {
      delete index "magda"
    } map { a =>
      client.execute {
        create index "magda" mappings (
          "datasets" as (
            "temporal" nested (
              "end" nested (
                "text" typed StringType
              ),
                "start" nested (
                  "text" typed StringType
                )
            )
          )
        )
      }
    }
  }

  override def index(dataSets: List[DataSet]) = {
    setupFuture.flatMap(a =>
      client.execute {
        bulk(
          dataSets.map(dataSet =>
            ElasticDsl.index into "magda" / "datasets" source dataSet.toJson
          )
        )
      }
    )
  }

  override def search(queryText: String) =
    setupFuture.flatMap(a =>
      client.execute {
        ElasticDsl.search in "magda" / "datasets" query queryText
      } map { response =>
        new SearchResult(
          hitCount = response.getHits.totalHits().toInt,
          dataSets = response.as[DataSet].toList
        )
      }
    )
}